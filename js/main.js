/* Carmaster — UI interactions: nav state, scroll reveals,
   stat counters, bento hover glow. No dependencies. */

(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- footer year ---- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- nav background on scroll ---- */
  var nav = document.getElementById("nav");
  function onScroll() {
    nav.classList.toggle("is-scrolled", window.scrollY > 24);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- mobile nav toggle ---- */
  var navToggle = document.getElementById("nav-toggle");
  var navLinks = document.getElementById("nav-links");
  if (navToggle && navLinks) {
    function closeMenu() {
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Open menu");
      navLinks.classList.remove("is-open");
      document.body.style.overflow = "";
    }
    function openMenu() {
      navToggle.setAttribute("aria-expanded", "true");
      navToggle.setAttribute("aria-label", "Close menu");
      navLinks.classList.add("is-open");
      document.body.style.overflow = "hidden";
    }
    navToggle.addEventListener("click", function () {
      if (navToggle.getAttribute("aria-expanded") === "true") closeMenu();
      else openMenu();
    });
    navLinks.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ---- reveal on scroll ---- */
  var revealEls = document.querySelectorAll(".reveal");
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.01, rootMargin: "0px 0px 15% 0px" });
    revealEls.forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 70 + "ms";
      io.observe(el);
    });
  }

  /* ---- animated stat counters ---- */
  var stats = document.querySelectorAll("[data-count]");
  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var isDecimal = String(el.getAttribute("data-count")).indexOf(".") !== -1;
    var start = performance.now();
    var DURATION = 1400;
    function frame(now) {
      var p = Math.min((now - start) / DURATION, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = target * eased;
      el.textContent = isDecimal ? val.toFixed(1) : Math.round(val);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    stats.forEach(function (el) { el.textContent = el.getAttribute("data-count"); });
  } else {
    var statIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          statIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    stats.forEach(function (el) { statIO.observe(el); });
  }

  /* ---- FAQ see more / see less ---- */
  var faqToggle = document.getElementById("faq-toggle");
  var faqList = document.getElementById("faq-list");
  if (faqToggle && faqList) {
    faqToggle.addEventListener("click", function () {
      var expanded = faqToggle.getAttribute("aria-expanded") === "true";
      var label = faqToggle.querySelector(".faq-toggle__label");
      if (expanded) {
        faqList.classList.remove("is-expanded");
        faqToggle.setAttribute("aria-expanded", "false");
        label.textContent = "See more questions";
        faqToggle.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
      } else {
        faqList.classList.add("is-expanded");
        faqToggle.setAttribute("aria-expanded", "true");
        label.textContent = "See less";
      }
    });
  }

  /* ---- bento cursor glow ---- */
  document.querySelectorAll(".bento__card").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", (e.clientX - rect.left) + "px");
      card.style.setProperty("--my", (e.clientY - rect.top) + "px");
    }, { passive: true });
  });
})();
