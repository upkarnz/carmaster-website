/* Carmaster — motion engine (NUDOT-style choreography).
   Preloader → kinetic hero type → Lenis smooth scroll →
   GSAP ScrollTrigger: parallax, journey scrollytelling,
   pinned horizontal showcase.

   Degrades cleanly: without GSAP/Lenis (CDN down) or with
   prefers-reduced-motion, the preloader still lifts and every
   section renders in its static, fully readable state. */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  var preloader = document.getElementById("preloader");

  /* ---------------- preloader ---------------- */
  var MIN_SHOW = 900; // ms — long enough to read, short enough to not annoy
  var shownAt = performance.now();

  function liftPreloader(cb) {
    if (!preloader) { if (cb) cb(); return; }
    var wait = Math.max(0, MIN_SHOW - (performance.now() - shownAt));
    setTimeout(function () {
      preloader.classList.add("is-done");
      document.body.classList.add("is-loaded");
      if (cb) cb();
    }, reduced ? 0 : wait);
  }

  /* ---------------- static fallback ---------------- */
  if (reduced || !hasGsap) {
    liftPreloader();
    // Journey: all steps readable, dial shows 01
    document.querySelectorAll(".journey__step").forEach(function (el) {
      el.classList.add("is-active");
    });
    return; // showcase falls back to native horizontal scroll (CSS)
  }

  var gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger);
  var ScrollTrigger = window.ScrollTrigger;

  // Re-measure when the tab becomes visible — layouts measured in a
  // hidden/backgrounded tab can be stale (preview panels, restored tabs).
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) ScrollTrigger.refresh();
  });

  /* ---------------- split hero headline into chars ---------------- */
  function splitChars(el) {
    var text = el.textContent;
    el.textContent = "";
    el.setAttribute("aria-label", text);
    var chars = [];
    text.split(" ").forEach(function (word, wi, words) {
      var w = document.createElement("span");
      w.className = "split-word";
      w.setAttribute("aria-hidden", "true");
      word.split("").forEach(function (ch) {
        var c = document.createElement("span");
        c.className = "split-char";
        c.textContent = ch;
        w.appendChild(c);
        chars.push(c);
      });
      el.appendChild(w);
      if (wi < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
    return chars;
  }

  var allChars = [];
  document.querySelectorAll("[data-split]").forEach(function (el) {
    allChars = allChars.concat(splitChars(el));
  });

  // Hide hero elements before the curtain lifts (invisible behind preloader)
  var fxEls = gsap.utils.toArray(".hero [data-fx]");
  gsap.set(allChars, { yPercent: 115, opacity: 0 });
  gsap.set(fxEls, { y: 26, opacity: 0 });

  function playHero() {
    ScrollTrigger.refresh(); // layout settled (fonts, pin spacers) — re-measure
    gsap.timeline({ defaults: { ease: "power4.out" } })
      .to(allChars, { yPercent: 0, opacity: 1, duration: 1.0, stagger: 0.028 }, 0.1)
      .to(fxEls, { y: 0, opacity: 1, duration: 0.9, stagger: 0.12 }, 0.45);
  }

  if (document.readyState === "complete") {
    liftPreloader(playHero);
  } else {
    window.addEventListener("load", function () { liftPreloader(playHero); });
    // Safety net: never trap the user behind the curtain
    setTimeout(function () { liftPreloader(playHero); }, 4000);
  }

  // Web fonts can keep swapping in after "load" fires, reflowing headings
  // and changing section heights — which leaves pinned sections (the
  // horizontal showcase) with a stale, oversized scroll-spacer and a
  // stretch of dead/blank scroll space. Re-measure once fonts settle.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
  // Final safety net in case something else reflows late (late images,
  // slow model load affecting layout, etc.)
  window.addEventListener("load", function () {
    setTimeout(function () { ScrollTrigger.refresh(); }, 1200);
  });

  /* ---------------- gentle parallax on section headings ---------------- */
  gsap.utils.toArray(".section__head, .stats__copy").forEach(function (el) {
    gsap.from(el, {
      y: 48,
      opacity: 0.4,
      ease: "none",
      scrollTrigger: { trigger: el, start: "top 92%", end: "top 55%", scrub: true },
    });
  });

  /* ---------------- journey scrollytelling ---------------- */
  var steps = gsap.utils.toArray(".journey__step");
  var numEl = document.getElementById("journey-num");
  var ringEl = document.getElementById("journey-ring");
  var RING_LEN = 339.3;

  if (steps.length && numEl && ringEl) {
    steps.forEach(function (step) {
      ScrollTrigger.create({
        trigger: step,
        start: "top 75%",
        end: "bottom 25%",
        onToggle: function (self) {
          if (!self.isActive) return;
          steps.forEach(function (s) { s.classList.toggle("is-active", s === step); });
          numEl.textContent = step.getAttribute("data-step");
        },
      });
    });

    gsap.to(ringEl, {
      strokeDashoffset: 0,
      ease: "none",
      scrollTrigger: {
        trigger: ".journey__steps",
        start: "top 60%",
        end: "bottom 40%",
        scrub: true,
      },
    });
    gsap.set(ringEl, { strokeDasharray: RING_LEN, strokeDashoffset: RING_LEN });
  }

  /* ---------------- horizontal showcase ----------------
     Previously scroll-jacked with a GSAP ScrollTrigger pin: the track
     was transformed based on manually computed scroll distance. That
     pin math broke whenever the browser restored a mid-page scroll
     position before GSAP had measured the layout (reload, back-nav),
     rendering the whole section thousands of pixels off-screen. A
     plain horizontally-scrolling row can't get "off-screen" — it has
     no computed offset to get wrong — so it replaces the pin outright
     rather than patching the pin again. */
  var viewport = document.getElementById("showcase-viewport");
  var track = document.getElementById("showcase-track");
  var idxEl = document.getElementById("showcase-idx");

  if (viewport && track && idxEl) {
    var cardCount = track.children.length;
    var updateIdx = function () {
      var distance = track.scrollWidth - viewport.clientWidth;
      var progress = distance > 0 ? viewport.scrollLeft / distance : 0;
      var i = Math.min(cardCount, Math.max(1, Math.round(progress * (cardCount - 1)) + 1));
      idxEl.textContent = (i < 10 ? "0" : "") + i;
    };
    viewport.addEventListener("scroll", updateIdx, { passive: true });
  }
})();
