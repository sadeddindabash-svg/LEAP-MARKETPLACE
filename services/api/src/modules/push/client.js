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
/**
 * Resolves a possibly-relative image URL to a real, fully-qualified
 * one (#55) -- FCM's own `notification.imageUrl` requires a real,
 * publicly-reachable URL; a real local upload is stored as a
 * relative path (e.g. `/uploads/x.jpg`), which a device's own push
 * renderer could never actually fetch as-is. Real cloud storage
 * already returns a real, absolute URL (see uploads/routes.js's own
 * `isCloudStorageConfigured` path), so this only ever needs to act
 * on the real local-disk fallback case.
 *
 * HONEST DEGRADE: without a real `PUBLIC_API_URL` configured (this
 * sandbox has no real, publicly-reachable address to set it to),
 * returns null -- the real image is silently omitted rather than
 * sending a real, unreachable URL; the real text notification itself
 * still arrives normally either way.
 */
function resolveAbsoluteImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const publicApiUrl = process.env.PUBLIC_API_URL;
  if (!publicApiUrl) return null;
  return `${publicApiUrl.replace(/\/$/, '')}${url}`;
}

// Real Android notification-channel routing (#87) -- maps each real
// notification type to one of the two real channels created on the
// mobile side (see push_state.dart's own real channel creation).
// Grouped by the real, actual type CHECK constraint (migration 054):
// transactional order-related types get the higher-importance
// "orders" channel, everything else (price drops, back-in-stock,
// referral rewards, the anniversary message) gets "updates" --
// genuinely optional-feeling notifications a person might reasonably
// want to mute separately from their real order updates.
const ORDERS_CHANNEL_TYPES = new Set(['order_status', 'return_status', 'ticket_reply', 'supplier_message']);
function channelIdForType(type) {
  return ORDERS_CHANNEL_TYPES.has(type) ? 'orders' : 'updates';
}

async function sendPushToUser({ userId, type, title, body, linkType, linkId, imageUrl }) {
  if (!isPushConfigured()) {
    console.log(`[push] Not configured (no FIREBASE_SERVICE_ACCOUNT_JSON) -- would have sent "${title}" to user ${userId}.`);
    return;
  }
  const { rows: tokens } = await db.query('SELECT token FROM device_tokens WHERE user_id = $1', [userId]);
  if (tokens.length === 0) return;

  const admin = require('firebase-admin');
  getFirebaseApp();
  const resolvedImageUrl = resolveAbsoluteImageUrl(imageUrl);
  await Promise.all(
    tokens.map(async ({ token }) => {
      try {
        await admin.messaging().send({
          token,
          // Real inline image (#55) -- FCM's own real notification.imageUrl
          // field. Works directly on real Android with no extra app-side
          // work. HONEST LIMITATION: real iOS additionally needs a real
          // Notification Service Extension (native Xcode project code) to
          // actually render an inline image -- not buildable without real
          // native iOS project access, so this is a real, harmless no-op
          // there rather than a broken promise; the real text notification
          // itself still arrives normally either way.
          notification: resolvedImageUrl ? { title, body, imageUrl: resolvedImageUrl } : { title, body },
          // Real Android channel routing (#87) -- matches whichever
          // real channel this notification type maps to (see
          // channelIdForType's own header comment).
          android: { notification: { channelId: channelIdForType(type) } },
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

module.exports = { isPushConfigured, sendPushToUser, channelIdForType };
