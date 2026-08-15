const webpush = require("web-push");
const { checkAuth, readBlobJson } = require("./_lib");
const CASE_STUDIES = require("../data/case-studies.json");

const SUB_PATH = "backstory/subscription.json";

const SLOT_INDEX = { morning: 0, midday: 1, evening: 2, night: 3 };

function dayOfYear(d) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 0));
  const diff = d - start;
  return Math.floor(diff / 86400000);
}

// Mirrors the client's seededOrder() in app.js — same seed, same math —
// so the in-app "today's spotlight" always matches the morning push.
function seededOrder(n, seed) {
  const arr = Array.from({ length: n }, (_, i) => i);
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickForSlot(slot) {
  const order = seededOrder(CASE_STUDIES.length, 42);
  const slotIdx = SLOT_INDEX[slot] ?? 0;
  const idx = order[(dayOfYear(new Date()) * 4 + slotIdx) % CASE_STUDIES.length];
  return CASE_STUDIES[idx];
}

module.exports = async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: "unauthorized" });

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(500).json({ error: "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set in this deployment's env vars" });
  }

  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:you@example.com",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const slot = (req.query && req.query.slot) || "morning";

    const sub = await readBlobJson(SUB_PATH);
    if (!sub) return res.status(200).json({ skipped: "no push subscription registered yet" });

    const cs = pickForSlot(slot);
    const message = {
      title: `${cs.emoji} ${cs.company}`,
      body: cs.hook,
      slug: cs.slug,
    };

    await webpush.sendNotification(sub, JSON.stringify(message));
    return res.status(200).json({ sent: true, message });
  } catch (e) {
    return res.status(500).json({ error: "notify handler crashed", detail: String((e && e.message) || e) });
  }
};
