/* Carmaster — contact popup.
   Floating "Contact" button opens a modal offering WhatsApp, phone
   and Messenger. Also opened by the nav "Contact" link. Closes on
   backdrop click, the × button, or Escape; restores focus on close. */

(function () {
  "use strict";

  var fab = document.getElementById("contact-fab");
  var modal = document.getElementById("contact-modal");
  if (!fab || !modal) return;

  var lastFocus = null;

  function open() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    // next frame → CSS transition
    requestAnimationFrame(function () { modal.classList.add("is-open"); });
    var first = modal.querySelector(".channel");
    if (first) first.focus();
    document.addEventListener("keydown", onKey);
  }

  function close() {
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKey);
    // Some browsers (notably Safari with "Reduce Motion" on, which forces
    // near-zero transition durations site-wide) never fire transitionend
    // for a sub-millisecond transition — leaving this fixed, full-screen
    // overlay in the DOM and blocking all scroll/taps on the page behind
    // it. A timeout fallback guarantees it always gets hidden.
    var hideOnce = function () {
      if (modal.hidden) return;
      modal.hidden = true;
      modal.removeEventListener("transitionend", hideOnce);
      clearTimeout(fallback);
    };
    var fallback = setTimeout(hideOnce, 320);
    modal.addEventListener("transitionend", hideOnce);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onKey(e) {
    if (e.key === "Escape") close();
  }

  fab.addEventListener("click", open);

  modal.querySelectorAll("[data-close]").forEach(function (el) {
    el.addEventListener("click", close);
  });

  // Tapping a channel closes the popup after the link opens
  modal.querySelectorAll(".channel").forEach(function (el) {
    el.addEventListener("click", function () { setTimeout(close, 150); });
  });

  // Route the nav "Contact" link to the popup instead of the footer anchor
  document.querySelectorAll('a[href="#contact"]').forEach(function (a) {
    if (a.closest(".nav__links")) {
      a.addEventListener("click", function (e) { e.preventDefault(); open(); });
    }
  });
})();
