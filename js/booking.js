/* Tui Torque Motors — booking form.
   Rego + service + contact are required; the details box is optional.
   Submits straight to /api/book (a Vercel serverless function that
   emails the workshop via Resend) — no dependency on the visitor
   having an email app configured. Falls back to a clear "call us"
   message if the request fails for any reason. */

(function () {
  "use strict";

  var form = document.getElementById("book-form");
  if (!form) return;

  var regoInput = document.getElementById("rego-input");
  var submitBtn = document.getElementById("book-submit");

  function normalisePlate(raw) {
    return (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  }

  regoInput.addEventListener("input", function () {
    regoInput.value = normalisePlate(regoInput.value);
  });

  function showResult(kind, message, linkText, linkHref) {
    var existing = form.querySelector(".booking__done");
    if (existing) existing.remove();

    var done = document.createElement("p");
    done.className = "booking__done" + (kind === "error" ? " booking__done--error" : "");

    var strong = document.createElement("b");
    strong.textContent = kind === "error" ? "Couldn't send that." : "Booking sent!";
    done.appendChild(strong);
    done.appendChild(document.createTextNode(" " + message + " "));

    if (linkText && linkHref) {
      var link = document.createElement("a");
      link.href = linkHref;
      link.textContent = linkText;
      done.appendChild(link);
      done.appendChild(document.createTextNode("."));
    }
    form.appendChild(done);
    done.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var plate = normalisePlate(regoInput.value);
    var name = document.getElementById("book-name").value.trim();
    var phone = document.getElementById("book-phone").value.trim();
    var details = document.getElementById("book-details").value.trim();
    var website = document.getElementById("book-hpot").value; // honeypot
    var service = form.querySelector('input[name="service"]:checked').value;

    if (plate.length < 2) { regoInput.focus(); return; }
    if (!name) { document.getElementById("book-name").focus(); return; }
    if (!phone) { document.getElementById("book-phone").focus(); return; }

    submitBtn.disabled = true;
    var originalLabel = submitBtn.textContent;
    submitBtn.textContent = "Sending…";

    fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plate: plate, service: service, name: name, phone: phone, details: details, website: website }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("send failed");
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok) throw new Error("send failed");
        showResult(
          "success",
          "We've got your booking for " + plate + " — we'll confirm a time by phone or text shortly. Prefer to talk now? Call",
          "09 869 7579",
          "tel:098697579"
        );
        form.reset();
      })
      .catch(function () {
        showResult(
          "error",
          "That didn't go through — please call or text us directly so we don't miss your booking:",
          "09 869 7579",
          "tel:098697579"
        );
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      });
  });
})();
