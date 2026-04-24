/**
 * Elevate Bali Studio — Main JavaScript
 * Handles: navbar, mobile menu, scroll reveals, lightbox, CSRF form, WhatsApp float
 */

(function () {
    'use strict';

    // --- Footer Year ---
    const yearEl = document.getElementById('footerYear');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // --- Navbar Scroll ---
    const nav = document.getElementById('nav');

    function handleNavScroll() {
        if (window.scrollY > 60) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    }
    window.addEventListener('scroll', handleNavScroll, { passive: true });

    // --- Mobile Menu ---
    const burger = document.getElementById('navBurger');
    const navLinks = document.getElementById('navLinks');

    if (burger && navLinks) {
        burger.addEventListener('click', () => {
            const isOpen = navLinks.classList.toggle('active');
            burger.classList.toggle('active');
            burger.setAttribute('aria-expanded', isOpen);
            document.body.style.overflow = isOpen ? 'hidden' : '';
        });

        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                burger.classList.remove('active');
                burger.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
            });
        });
    }

    // --- Scroll Reveal ---
    const revealEls = document.querySelectorAll('.reveal-up');

    function revealOnScroll() {
        const trigger = window.innerHeight * 0.88;
        revealEls.forEach(el => {
            if (el.getBoundingClientRect().top < trigger) {
                el.classList.add('visible');
            }
        });
    }
    window.addEventListener('scroll', revealOnScroll, { passive: true });
    revealOnScroll();

    // --- WhatsApp Float ---
    const waFloat = document.getElementById('waFloat');
    function handleWaFloat() {
        if (window.scrollY > 400) {
            waFloat.classList.add('visible');
        } else {
            waFloat.classList.remove('visible');
        }
    }
    window.addEventListener('scroll', handleWaFloat, { passive: true });

    // =========================================
    // LIGHTBOX
    // =========================================
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxTitle = document.getElementById('lightboxTitle');
    const lightboxDesc = document.getElementById('lightboxDesc');
    const lightboxClose = document.getElementById('lightboxClose');
    const lightboxPrev = document.getElementById('lightboxPrev');
    const lightboxNext = document.getElementById('lightboxNext');
    const lightboxCta = document.getElementById('lightboxCta');
    const portfolioCards = document.querySelectorAll('.portfolio-card[data-lightbox-src]');

    let currentLightboxIndex = 0;

    function openLightbox(index) {
        const card = portfolioCards[index];
        if (!card) return;

        currentLightboxIndex = index;
        lightboxImg.src = card.getAttribute('data-lightbox-src');
        lightboxImg.alt = card.getAttribute('data-lightbox-title');
        lightboxTitle.textContent = card.getAttribute('data-lightbox-title');
        lightboxDesc.textContent = card.getAttribute('data-lightbox-desc');

        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }

    function navigateLightbox(direction) {
        let next = currentLightboxIndex + direction;
        if (next < 0) next = portfolioCards.length - 1;
        if (next >= portfolioCards.length) next = 0;
        openLightbox(next);
    }

    // Click on portfolio cards
    portfolioCards.forEach((card, i) => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            openLightbox(i);
        });
    });

    // Close button
    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);

    // Navigation arrows
    if (lightboxPrev) lightboxPrev.addEventListener('click', () => navigateLightbox(-1));
    if (lightboxNext) lightboxNext.addEventListener('click', () => navigateLightbox(1));

    // Close on backdrop click
    if (lightbox) {
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) closeLightbox();
        });
    }

    // Close on Escape, navigate with arrows
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') navigateLightbox(-1);
        if (e.key === 'ArrowRight') navigateLightbox(1);
    });

    // CTA in lightbox should close it and navigate to contact
    if (lightboxCta) {
        lightboxCta.addEventListener('click', () => {
            closeLightbox();
        });
    }

    // =========================================
    // CSRF + CONTACT FORM (Secure Backend)
    // =========================================
    const form = document.getElementById('contactForm');
    const submitBtn = document.getElementById('formSubmit');
    const csrfField = document.getElementById('formCsrf');
    const formStatus = document.getElementById('formStatus');

    // Fetch CSRF token on page load
    async function fetchCsrfToken() {
        try {
            const res = await fetch('/api/csrf-token');
            const data = await res.json();
            if (csrfField && data.token) {
                csrfField.value = data.token;
            }
        } catch (err) {
            console.warn('CSRF token fetch failed — form will still work in dev mode');
        }
    }
    fetchCsrfToken();

    if (form && submitBtn) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            const btnText = submitBtn.querySelector('span');
            const original = btnText.textContent;

            // Clear previous status
            if (formStatus) {
                formStatus.textContent = '';
                formStatus.className = 'form-status';
            }

            // Loading state
            submitBtn.disabled = true;
            btnText.textContent = 'Sending…';
            submitBtn.style.opacity = '0.7';

            try {
                const formData = new FormData(form);
                const body = Object.fromEntries(formData.entries());

                const res = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                const data = await res.json();

                if (data.success) {
                    btnText.textContent = 'Message Sent ✓';
                    submitBtn.style.background = '#22c55e';
                    submitBtn.style.borderColor = '#22c55e';
                    submitBtn.style.color = '#fff';
                    submitBtn.style.opacity = '1';

                    if (formStatus) {
                        formStatus.textContent = data.message || 'We\'ll get back to you within 24 hours.';
                        formStatus.className = 'form-status success';
                    }

                    form.reset();
                    // Get a new CSRF token for next submission
                    fetchCsrfToken();

                    setTimeout(() => {
                        btnText.textContent = original;
                        submitBtn.disabled = false;
                        submitBtn.style = '';
                    }, 4000);
                } else {
                    throw new Error(data.errors ? data.errors.join('. ') : data.error || 'Submission failed.');
                }
            } catch (err) {
                btnText.textContent = 'Try Again';
                submitBtn.style.opacity = '1';

                if (formStatus) {
                    formStatus.textContent = err.message || 'Something went wrong. Please try again.';
                    formStatus.className = 'form-status error';
                }

                setTimeout(() => {
                    btnText.textContent = original;
                    submitBtn.disabled = false;
                    submitBtn.style = '';
                }, 3000);

                // Refresh CSRF in case it expired
                fetchCsrfToken();
            }
        });
    }

    // --- Smooth anchor offset for fixed nav ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                const offset = nav.offsetHeight + 20;
                const y = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        });
    });

})();
