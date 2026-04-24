/**
 * Elevate Bali Studio — Main JavaScript
 * Handles: navbar scroll, mobile menu, scroll reveals, form UX, WhatsApp float
 */

(function () {
    'use strict';

    // --- Footer Year ---
    const yearEl = document.getElementById('footerYear');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // --- Navbar Scroll ---
    const nav = document.getElementById('nav');
    let lastScroll = 0;

    function handleNavScroll() {
        const y = window.scrollY;
        if (y > 60) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
        lastScroll = y;
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
            const top = el.getBoundingClientRect().top;
            if (top < trigger) {
                el.classList.add('visible');
            }
        });
    }
    window.addEventListener('scroll', revealOnScroll, { passive: true });
    // First pass on load
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

    // --- Contact Form ---
    const form = document.getElementById('contactForm');
    const submitBtn = document.getElementById('formSubmit');

    if (form && submitBtn) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();

            const btnText = submitBtn.querySelector('span');
            const original = btnText.textContent;

            // Loading state
            submitBtn.disabled = true;
            btnText.textContent = 'Sending…';
            submitBtn.style.opacity = '0.7';

            // Simulate network request
            setTimeout(() => {
                btnText.textContent = 'Message Sent ✓';
                submitBtn.style.background = '#22c55e';
                submitBtn.style.borderColor = '#22c55e';
                submitBtn.style.color = '#fff';
                submitBtn.style.opacity = '1';

                form.reset();

                setTimeout(() => {
                    btnText.textContent = original;
                    submitBtn.disabled = false;
                    submitBtn.style = '';
                }, 3000);
            }, 1200);
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
