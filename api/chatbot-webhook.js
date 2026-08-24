/* Messenger + WhatsApp auto-reply webhook — one shared endpoint for both.
   Matches incoming customer messages against the site's FAQ content and
   replies instantly with a canned answer. No paid AI API involved, so
   this runs at zero ongoing cost beyond Meta's own (free, at this
   volume) messaging APIs.

   Setup (once the Meta Developer app + Page/WhatsApp are ready):
   1. In the Meta App dashboard, add the "Messenger" and "WhatsApp"
      products.
   2. Webhook URL: https://www.tuitorquemotors.com/api/chatbot-webhook
      Verify token: any string you choose — set it as CHATBOT_VERIFY_TOKEN
      below and in the Meta dashboard's webhook setup screen.
   3. Subscribe to the "messages" field for both the Page (Messenger)
      and the WhatsApp Business Account.
   4. Add these Vercel env vars:
        CHATBOT_VERIFY_TOKEN     — matches the token entered in Meta's dashboard
        PAGE_ACCESS_TOKEN        — Messenger: Page access token
        WHATSAPP_ACCESS_TOKEN    — WhatsApp: permanent access token
                                    (same token as api/book.js's WhatsApp
                                    notification, if already configured)
        WHATSAPP_PHONE_NUMBER_ID — WhatsApp: the Phone Number ID
   Redeploy after adding env vars. */

const GRAPH_VERSION = "v21.0";
const VERIFY_TOKEN = process.env.CHATBOT_VERIFY_TOKEN;

// Rotated so a customer sending several unmatched messages in a row doesn't
// get the exact same reply every time.
const FALLBACK_REPLIES = [
  "Thanks for messaging Tui Torque Motors! For anything specific, call or text " +
    "022 095 0555 / 09 869 7579, or book online at tuitorquemotors.com/#booking. " +
    "We're open Mon–Fri 9am–5pm, with weekend walk-ins for standard servicing.",
  "Not quite sure I've got that one — try asking about pricing, WOF, hours, or " +
    "booking, or call/text 022 095 0555 and we'll sort it out directly.",
  "You can always reach the workshop directly on 022 095 0555 (call or text) " +
    "if it's easier — otherwise ask me about servicing, pricing, WOF or hours.",
];

const GREETING_REPLY =
  "Hi, thanks for reaching out to Tui Torque Motors! Ask me about servicing, " +
  "WOF, pricing, wheel alignment, hours or booking — or call/text 022 095 0555 " +
  "to talk to the workshop directly.";

// Ordered: first matching rule wins, so put more specific keywords first.
// "hi"/"hey" need word-boundary matching (wholeWord) — as plain substrings
// they'd false-positive on "which", "this", "they", etc.
const FAQ_RULES = [
  {
    keywords: ["hi", "hello", "hey", "kia ora", "good morning", "good afternoon"],
    wholeWord: true,
    reply: GREETING_REPLY,
  },
  {
    keywords: ["wof", "warrant of fitness"],
    reply:
      "WOF inspections are available by appointment alongside our regular servicing. " +
      "Call or text 022 095 0555 for current WOF pricing and to book a time.",
  },
  {
    keywords: ["hybrid", "prius", "aqua", "electric"],
    reply:
      "Yes, we service hybrid vehicles as well as petrol and diesel — including Prius, " +
      "Aqua and similar models. Basic servicing for these starts from $119 +GST.",
  },
  {
    keywords: ["diagnostic", "scan", "fault", "check engine", "warning light"],
    reply:
      "A diagnostic scan is $60 +GST — full fault-code read, plain-English report and a " +
      "repair quote included. Text your rego to 022 095 0555 to book one in.",
  },
  {
    keywords: ["alignment", "wheel align", "tracking"],
    reply:
      "A four-wheel laser alignment starts at $80 +GST, with an optional nitrogen " +
      "inflation add-on and a steering check included.",
  },
  {
    keywords: ["hour", "open", "close", "saturday", "sunday", "weekend"],
    reply:
      "We're open Mon–Fri 9am–5pm. Walk-ins are welcome on Saturday and Sunday for " +
      "standard servicing. After-hours, WOF and repair appointments can be booked ahead.",
  },
  {
    keywords: ["address", "located", "location", "where are you", "directions"],
    reply:
      "We're at Unit 2, 69 Wiri Station Road, Wiri, Auckland 2104.",
  },
  {
    keywords: ["book", "appointment", "schedule"],
    reply:
      "Easiest way is our online form — tuitorquemotors.com/#booking (just your rego, the " +
      "service you need, and your contact). Or call/text 022 095 0555.",
  },
  {
    keywords: ["price", "cost", "how much", "quote"],
    reply:
      "Diagnostic scan $60, Basic service $160, Standard service $230, Wheel alignment $80 " +
      "(all +GST). Vehicle-type pricing and full details: tuitorquemotors.com/#pricing.",
  },
  {
    keywords: ["service", "servicing"],
    reply:
      "Basic Car Service (oil & filter, multi-point check, fluids, digital record) is $160 " +
      "+GST. Standard Service adds a brake & tyre inspection and battery test, from $230 +GST.",
  },
];

function keywordMatches(lower, keyword, wholeWord) {
  if (!wholeWord) return lower.includes(keyword);
  return new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower);
}

function matchReply(text) {
  const lower = String(text || "").toLowerCase();
  const rule = FAQ_RULES.find((r) => r.keywords.some((kw) => keywordMatches(lower, kw, r.wholeWord)));
  if (rule) return rule.reply;
  return FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A reply that lands in under a second reads as an obvious bot. This fakes
// a human reading + typing out the reply: a short "reading" pause, a
// typing indicator, then a further pause scaled to the reply's length
// (roughly a fast typist's pace), capped so we stay well inside Vercel's
// function timeout even for a multi-message webhook batch.
function typingDelayMs(text) {
  const READING_PAUSE_MS = 700;
  const MS_PER_CHAR = 28;
  const MAX_MS = 4000;
  return Math.min(READING_PAUSE_MS + String(text || "").length * MS_PER_CHAR, MAX_MS);
}

async function setMessengerTyping(recipientId, on) {
  const token = process.env.PAGE_ACCESS_TOKEN;
  if (!token) return;
  await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/me/messages?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      sender_action: on ? "typing_on" : "typing_off",
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => {});
}

async function sendMessengerText(recipientId, text) {
  const token = process.env.PAGE_ACCESS_TOKEN;
  if (!token) return;
  await setMessengerTyping(recipientId, true);
  await sleep(typingDelayMs(text));
  await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/me/messages?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: "RESPONSE",
    }),
    signal: AbortSignal.timeout(8000),
  });
}

async function markWhatsAppReadAndTyping(messageId) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId || !messageId) return;
  await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
      typing_indicator: { type: "text" },
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => {});
}

async function sendWhatsAppText(to, text, messageId) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return;
  await markWhatsAppReadAndTyping(messageId);
  await sleep(typingDelayMs(text));
  await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
    signal: AbortSignal.timeout(8000),
  });
}

async function handleMessengerEvent(body) {
  const entries = body.entry || [];
  for (const entry of entries) {
    const events = entry.messaging || [];
    for (const event of events) {
      const text = event.message && !event.message.is_echo ? event.message.text : null;
      const senderId = event.sender && event.sender.id;
      if (!text || !senderId) continue;
      await sendMessengerText(senderId, matchReply(text));
    }
  }
}

async function handleWhatsAppEvent(body) {
  const entries = body.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      const messages = (change.value && change.value.messages) || [];
      for (const message of messages) {
        const text = message.type === "text" ? message.text.body : null;
        const from = message.from;
        if (!text || !from) continue;
        await sendWhatsAppText(from, matchReply(text), message.id);
      }
    }
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const query = req.query || {};
    if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === VERIFY_TOKEN) {
      return res.status(200).send(query["hub.challenge"]);
    }
    return res.status(403).send("Verification failed");
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "method not allowed" });
  }

  const body = req.body || {};

  try {
    if (body.object === "page") {
      await handleMessengerEvent(body);
    } else if (body.object === "whatsapp_business_account") {
      await handleWhatsAppEvent(body);
    }
  } catch (err) {
    // Swallowed intentionally — Meta retries on non-200, and a failed
    // auto-reply shouldn't turn into a webhook retry storm.
  }

  return res.status(200).json({ ok: true });
}
