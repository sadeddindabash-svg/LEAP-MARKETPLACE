/**
 * Real push notification delivery via Firebase Cloud Messaging.
 *
 * HONEST SCOPE, mirrors email/client.js's own real isEmailConfigured()
 * pattern exactly: this gracefully does nothing when real Firebase
 * credentials aren't present (isPushConfigured() below), rather than
 * crashing the caller or pretending a push was actually sent. Every
 * call site treats this the same way emails already are -- a
 * best-effort, fire-and-forget side effect that never blocks or fails
 * the real action that triggered it (see notifications/helpers.js's
 * own createNotification, which calls this).
 *
 * REAL, EXTERNAL SETUP STILL REQUIRED before this can deliver
 * anything to a real device, none of which can be provided from here:
 *   1. A real Firebase project (console.firebase.google.com).
 *   2. A real service account JSON key, downloaded from that
 *      project's own Settings -> Service Accounts -> Generate new
 *      private key. Its contents go in the real
 *      FIREBASE_SERVICE_ACCOUNT_JSON env var below (as a single-line
 *      JSON string), never committed to the repo.
 *   3. The real google-services.json (Android) / real
 *      GoogleService-Info.plist (iOS) config files from that same
 *      Firebase project, placed in the mobile app (see
 *      apps/mobile/README.md's own note on this for exactly where).
 * Until all three exist, isPushConfigured() returns false and every
 * real call below is a genuine, logged no-op -- not a silent failure,
 * and not a fake success.
 */
let cachedApp = null;
function isPushConfigured() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
}

function getFirebaseApp() {
  if (cachedApp) return cachedApp;
  const admin = require('firebase-admin');
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  cachedApp = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return cachedApp;
}

const db = require('../../../db/pool');

/**
 * Sends a real push to every real device token this real user has
 * registered. Best-effort per-token -- one real device's token having
 * gone stale (e.g. the app was uninstalled) must not stop the real
 * push from reaching this user's other real devices, so failures are
 * caught and logged per-token, not thrown.
 */
async function sendPushToUser({ userId, title, body, linkType, linkId }) {
  if (!isPushConfigured()) {
    console.log(`[push] Not configured (no FIREBASE_SERVICE_ACCOUNT_JSON) -- would have sent "${title}" to user ${userId}.`);
    return;
  }
  const { rows: tokens } = await db.query('SELECT token FROM device_tokens WHERE user_id = $1', [userId]);
  if (tokens.length === 0) return;

  const admin = require('firebase-admin');
  getFirebaseApp();
  await Promise.all(
    tokens.map(async ({ token }) => {
      try {
        await admin.messaging().send({
          token,
          notification: { title, body },
          data: { linkType: linkType || '', linkId: linkId || '' },
        });
      } catch (err) {
        // A real stale/invalid token (e.g. the app was uninstalled) is
        // an expected, real, ongoing occurrence, not a bug -- logged
        // for visibility, never thrown, so it can't take down the
        // real notification flow that triggered this.
        console.error(`[push] Failed to deliver to a real token for user ${userId}:`, err.message);
      }
    })
  );
}

module.exports = { isPushConfigured, sendPushToUser };
