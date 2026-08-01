/* Booking endpoint — receives the website's booking form and emails
   the workshop via Resend. Deploy as a Vercel serverless function
   (this file at /api/book.js is picked up automatically).

   Setup:
   1. Sign up at resend.com, verify tuitorquemotors.com as a sending
      domain (or use their onboarding@resend.dev test address to
      start — see FROM_EMAIL below).
   2. Create an API key, add it to Vercel as the env var
      RESEND_API_KEY (Project → Settings → Environment Variables).
   3. Optionally set BOOKING_TO_EMAIL to override where bookings land
      (defaults to info@tuitorquemotors.com).
   4. Redeploy. The form on the site already POSTs here — nothing
      else to wire up. */

const RESEND_URL = "https://api.resend.com/emails";
const TO_EMAIL = process.env.BOOKING_TO_EMAIL || "info@tuitorquemotors.com";
// Resend requires the "from" address's domain to be verified in their
// dashboard. Until tuitorquemotors.com is verified there, this falls
// back to Resend's own test sender so the endpoint still works.
const FROM_EMAIL = process.env.BOOKING_FROM_EMAIL || "Tui Torque Motors <onboarding@resend.dev>";

const MAX_LEN = { plate: 8, service: 80, name: 80, phone: 30, details: 800 };

function clean(value, maxLen) {
  return String(value || "").trim().slice(0, maxLen);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method not allowed" });
  }

  const body = req.body || {};

  // Honeypot: real visitors never fill this hidden field. Bots that
  // blindly fill every input do — accept silently, send nothing.
  if (clean(body.website, 50)) {
    return res.status(200).json({ ok: true });
  }

  const plate = clean(body.plate, MAX_LEN.plate);
  const service = clean(body.service, MAX_LEN.service);
  const name = clean(body.name, MAX_LEN.name);
  const phone = clean(body.phone, MAX_LEN.phone);
  const details = clean(body.details, MAX_LEN.details);

  if (!plate || !name || !phone) {
    return res.status(400).json({ ok: false, error: "missing required fields" });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ ok: false, error: "booking email not configured" });
  }

  const lines = [
    "New booking request — Tui Torque Motors website",
    "",
    "Plate:   " + plate,
    "Service: " + service,
    "Name:    " + name,
    "Phone:   " + phone,
  ];
  if (details) lines.push("Details: " + details);
  const text = lines.join("\n");
  const html = "<pre style=\"font:14px monospace\">" +
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;") +
    "</pre>";

  try {
    const upstream = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: TO_EMAIL,
        subject: "Booking request — " + plate,
        text,
        html,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      var upstreamBody = await upstream.text();
      // TEMP DEBUG: surface Resend's actual rejection reason so setup
      // issues (unverified domain, bad key, etc.) are visible instead
      // of a generic failure. Remove the debug field once this is
      // confirmed working end-to-end.
      return res.status(502).json({ ok: false, error: "email send failed", debug: upstreamBody, status: upstream.status });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(502).json({ ok: false, error: "email send failed" });
  }
}
