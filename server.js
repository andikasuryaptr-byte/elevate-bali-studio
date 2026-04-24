/**
 * Elevate Bali Studio — Secure Backend Server
 * 
 * Security layers:
 *  1. Helmet: Sets ~15 HTTP security headers (CSP, HSTS, XSS, etc.)
 *  2. CORS: Whitelist-only origin policy
 *  3. Rate Limiting: Max 5 contact submissions per IP per 15 min
 *  4. HPP: HTTP Parameter Pollution protection
 *  5. Input Validation & Sanitization (express-validator)
 *  6. Request size limits (16kb max body)
 *  7. No stack traces in production errors
 *  8. CSRF token on contact form
 */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// =========================================
// 1. HELMET — Security Headers
// =========================================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
        }
    },
    crossOriginEmbedderPolicy: false, // Allow Google Fonts
}));

// =========================================
// 2. CORS — Origin Whitelist
// =========================================
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.ALLOWED_ORIGIN // e.g. https://elevatebali.studio
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true
}));

// =========================================
// 3. BODY PARSING — Limit request size
// =========================================
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));

// =========================================
// 4. HPP — HTTP Parameter Pollution
// =========================================
app.use(hpp());

// =========================================
// 5. RATE LIMITING
// =========================================
// General rate limit for all routes
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests. Please try again later.' }
});
app.use(generalLimiter);

// Strict rate limit for contact form
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Only 5 submissions per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many submissions. Please wait 15 minutes.' }
});

// =========================================
// 6. CSRF TOKEN SYSTEM
// =========================================
const csrfTokens = new Map(); // token -> { created, ip }

// Clean expired tokens every 30 minutes
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of csrfTokens) {
        if (now - data.created > 30 * 60 * 1000) {
            csrfTokens.delete(token);
        }
    }
}, 30 * 60 * 1000);

// Generate CSRF token endpoint
app.get('/api/csrf-token', (req, res) => {
    const token = crypto.randomBytes(32).toString('hex');
    csrfTokens.set(token, { created: Date.now(), ip: req.ip });
    res.json({ token });
});

// =========================================
// 7. STATIC FILES — Serve frontend
// =========================================
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: isProd ? '1d' : 0,
    etag: true,
}));

// =========================================
// 8. CONTACT FORM ENDPOINT
// =========================================

// Email transporter (configure via .env)
let transporter = null;
if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        }
    });
}

// Validation + sanitization rules
const contactValidation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters')
        .matches(/^[a-zA-Z\s'.,-]+$/).withMessage('Name contains invalid characters')
        .escape(),
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email address')
        .normalizeEmail()
        .isLength({ max: 254 }).withMessage('Email too long'),
    body('service')
        .trim()
        .notEmpty().withMessage('Service is required')
        .isIn(['web', 'hospitality', 'seo', 'other']).withMessage('Invalid service selected'),
    body('message')
        .trim()
        .notEmpty().withMessage('Message is required')
        .isLength({ min: 10, max: 2000 }).withMessage('Message must be 10-2000 characters')
        .escape(),
    body('csrf')
        .trim()
        .notEmpty().withMessage('Security token missing'),
];

app.post('/api/contact', contactLimiter, contactValidation, async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array().map(e => e.msg)
            });
        }

        // Verify CSRF token
        const { csrf, name, email, service, message } = req.body;
        const tokenData = csrfTokens.get(csrf);

        if (!tokenData) {
            return res.status(403).json({
                success: false,
                error: 'Invalid or expired security token. Please refresh the page.'
            });
        }

        // Token is single-use — delete it
        csrfTokens.delete(csrf);

        // Check token age (max 30 min)
        if (Date.now() - tokenData.created > 30 * 60 * 1000) {
            return res.status(403).json({
                success: false,
                error: 'Security token expired. Please refresh the page.'
            });
        }

        // Honeypot check (hidden field — bots fill it)
        if (req.body.website) {
            // Silently reject — bot detected
            return res.json({ success: true, message: 'Message sent successfully.' });
        }

        const serviceNames = {
            'web': 'Bespoke Web Development',
            'hospitality': 'Hospitality Solutions',
            'seo': 'Local SEO & Visibility',
            'other': 'Other'
        };

        const submissionData = {
            id: crypto.randomUUID(),
            name,
            email,
            service: serviceNames[service] || service,
            message,
            ip: req.ip,
            timestamp: new Date().toISOString()
        };

        // Save to file (append to JSON log)
        const logDir = path.join(__dirname, 'data');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        const logFile = path.join(logDir, 'messages.json');
        let messages = [];
        if (fs.existsSync(logFile)) {
            try {
                messages = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
            } catch { messages = []; }
        }
        messages.push(submissionData);
        fs.writeFileSync(logFile, JSON.stringify(messages, null, 2));

        // Send to Google Sheets via Apps Script
        const sheetsUrl = process.env.GOOGLE_SHEETS_URL;
        if (sheetsUrl) {
            try {
                await fetch(sheetsUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        email,
                        service: serviceNames[service] || service,
                        message,
                        timestamp: submissionData.timestamp
                    })
                });
                console.log('  ✓ Data sent to Google Sheets');
            } catch (sheetErr) {
                console.error('Google Sheets sync failed:', sheetErr.message);
                // Don't fail the request — message is already saved locally
            }
        }

        // Send email notification if configured
        if (transporter) {
            try {
                await transporter.sendMail({
                    from: `"Elevate Bali Website" <${process.env.SMTP_USER}>`,
                    to: process.env.NOTIFY_EMAIL || 'andikasuryaptr@gmail.com',
                    replyTo: email,
                    subject: `New Lead: ${serviceNames[service]} — ${name}`,
                    html: `
                        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                            <h2 style="color:#0a1628;">New Contact Submission</h2>
                            <table style="width:100%;border-collapse:collapse;">
                                <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${name}</td></tr>
                                <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;">${email}</td></tr>
                                <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Service</td><td style="padding:8px;border-bottom:1px solid #eee;">${serviceNames[service]}</td></tr>
                                <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Message</td><td style="padding:8px;border-bottom:1px solid #eee;">${message}</td></tr>
                            </table>
                            <p style="color:#999;font-size:12px;margin-top:20px;">IP: ${req.ip} | ${submissionData.timestamp}</p>
                        </div>
                    `
                });
            } catch (mailErr) {
                console.error('Email send failed:', mailErr.message);
                // Don't fail the request — message is already saved
            }
        }

        console.log(`✉ New message from ${name} (${email}) — ${serviceNames[service]}`);
        res.json({ success: true, message: 'Message sent successfully. We\'ll get back to you within 24 hours.' });

    } catch (err) {
        console.error('Contact form error:', err);
        res.status(500).json({
            success: false,
            error: isProd ? 'Something went wrong. Please try again.' : err.message
        });
    }
});

// =========================================
// 9. CATCH-ALL — Serve index.html for SPA
// =========================================
app.get('{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =========================================
// 10. ERROR HANDLER — No stack leaks
// =========================================
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        success: false,
        error: isProd ? 'Internal server error.' : err.message
    });
});

// =========================================
// START SERVER
// =========================================
app.listen(PORT, () => {
    console.log(`\n  ◆ Elevate Bali Studio — Server running`);
    console.log(`  → http://localhost:${PORT}`);
    console.log(`  → Environment: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`  → Google Sheets: ${process.env.GOOGLE_SHEETS_URL ? 'CONNECTED ✓' : 'NOT CONFIGURED (add GOOGLE_SHEETS_URL to .env)'}`);
    console.log(`  → Email notifications: ${transporter ? 'ENABLED' : 'DISABLED (configure .env)'}`);
    console.log(`  → Security: Helmet ✓ | CORS ✓ | Rate Limit ✓ | CSRF ✓ | HPP ✓\n`);
});
