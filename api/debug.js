const { checkAuth, readBlobJson } = require("./_lib");

const SUB_PATH = "backstory/subscription.json";

// Compares the env vars actually configured on this deployment against the
// exact values generated during setup, without ever echoing the secrets
// back — just a match/mismatch signal to debug BadJwtToken-style errors
// caused by a copy-paste mistake (whitespace, truncation, swapped fields).
const EXPECTED_PUBLIC = "BJXLIPh4YoLx91Julz5elFgYJanLQ1OkfYW_fNeLjfwemFqcmbPmizV_bFuMwiKSr5aB5DYBT2-nV74Zbl-c8HQ";
const EXPECTED_PRIVATE = "Me_tT7PaQ6FLneu8F0bsX4Sceb71ojX8N-EuFxtzdS0";

module.exports = async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: "unauthorized" });

  const pub = process.env.VAPID_PUBLIC_KEY || "";
  const priv = process.env.VAPID_PRIVATE_KEY || "";

  const sub = await readBlobJson(SUB_PATH).catch(() => null);
  let endpointHost = null;
  try { endpointHost = sub ? new URL(sub.endpoint).host : null; } catch (e) { endpointHost = "unparseable"; }

  return res.status(200).json({
    publicKeyMatchesExpected: pub === EXPECTED_PUBLIC,
    publicKeyMatchesTrimmed: pub.trim() === EXPECTED_PUBLIC,
    publicKeyLength: pub.length,
    privateKeyMatchesExpected: priv === EXPECTED_PRIVATE,
    privateKeyMatchesTrimmed: priv.trim() === EXPECTED_PRIVATE,
    privateKeyLength: priv.length,
    vapidSubject: process.env.VAPID_SUBJECT || null,
    hasSubscription: Boolean(sub),
    subscriptionEndpointHost: endpointHost,
    subscriptionHasKeys: Boolean(sub && sub.keys && sub.keys.p256dh && sub.keys.auth),
  });
};
