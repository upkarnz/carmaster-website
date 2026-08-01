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
    var done = function () {
      modal.hidden = true;
      modal.removeEventListener("transitionend", done);
    };
    modal.addEventListener("transitionend", done);
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
