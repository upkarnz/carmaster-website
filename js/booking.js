/* Carmaster — simple booking form.
   Rego + service + contact are all that's required; the details
   box is optional. Submission opens a pre-filled email to the
   workshop — swap for a POST to a form endpoint when one exists. */

(function () {
  "use strict";

  var form = document.getElementById("book-form");
  if (!form) return;

  var regoInput = document.getElementById("rego-input");

  function normalisePlate(raw) {
    return (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  }

  regoInput.addEventListener("input", function () {
    regoInput.value = normalisePlate(regoInput.value);
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var plate = normalisePlate(regoInput.value);
    var name = document.getElementById("book-name").value.trim();
    var phone = document.getElementById("book-phone").value.trim();
    var details = document.getElementById("book-details").value.trim();
    var service = form.querySelector('input[name="service"]:checked').value;

    if (plate.length < 2) { regoInput.focus(); return; }
    if (!name) { document.getElementById("book-name").focus(); return; }
    if (!phone) { document.getElementById("book-phone").focus(); return; }

    var lines = [
      "New booking request — Carmaster website",
      "",
      "Plate:   " + plate,
      "Service: " + service,
      "Name:    " + name,
      "Phone:   " + phone,
    ];
    if (details) lines.push("Details: " + details);

    var mailto = "mailto:info@carmaster.co.nz" +
      "?subject=" + encodeURIComponent("Booking request — " + plate) +
      "&body=" + encodeURIComponent(lines.join("\n"));
    window.location.href = mailto;

    var existing = form.querySelector(".booking__done");
    if (existing) existing.remove();

    var done = document.createElement("p");
    done.className = "booking__done";
    var strong = document.createElement("b");
    strong.textContent = "Almost there!";
    done.appendChild(strong);
    done.appendChild(document.createTextNode(
      " Your email app has opened with the booking details — just press send. Prefer to talk? Call "
    ));
    var callLink = document.createElement("a");
    callLink.href = "tel:098697579";
    callLink.textContent = "09 869 7579";
    done.appendChild(callLink);
    done.appendChild(document.createTextNode("."));
    form.appendChild(done);
  });
})();
