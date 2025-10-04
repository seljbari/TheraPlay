// homepage/desgin.js
// Mobile nav, dark/light theme toggle, scroll reveal, current year

const navLinks = document.getElementById('nav-links');
const hamburger = document.getElementById('hamburger');
const themeToggle = document.getElementById('themeToggle');

// Mobile menu toggle
if (hamburger) {
  hamburger.addEventListener('click', () => {
    navLinks?.classList.toggle('open');
    hamburger.classList.toggle('active');
  });
}

// Theme toggle (optional manual override)
const LS_KEY = 'theraplay_theme';
const saved = localStorage.getItem(LS_KEY);
if (saved === 'dark') document.documentElement.classList.add('dark');
if (saved === 'light') document.documentElement.classList.remove('dark');

themeToggle?.addEventListener('click', () => {
  const dark = document.documentElement.classList.toggle('dark');
  localStorage.setItem(LS_KEY, dark ? 'dark' : 'light');
});

// Simple intersection observer for reveal animations
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      io.unobserve(e.target);
    }
  }
}, { threshold: 0.18 });

document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// Year in footer
document.getElementById('year').textContent = new Date().getFullYear();

// Smooth scroll for in-page anchors
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
