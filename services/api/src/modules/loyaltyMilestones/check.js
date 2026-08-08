const db = require('../../../db/pool');
const { createNotification } = require('../notifications/helpers');

/**
 * Real account-anniversary check (#58). Uses the real, already-
 * existing `users.created_at` field -- no fabricated signup date.
 *
 * CONFIRMED DESIGN: only real, FULL-YEAR anniversaries count (1 year,
 * 2 years, etc.) -- checked by matching today's real month+day
 * against each real user's own real signup month+day, for any user
 * who signed up at least one real year ago. A real
 * `last_anniversary_notified_year` column (migration 054) prevents a
 * real duplicate notification if this tick somehow runs more than
 * once on the real anniversary date itself.
 */
async function checkAccountAnniversaries() {
  const { rows: users } = await db.query(
    `SELECT id, created_at, COALESCE(last_anniversary_notified_year, 0) AS last_notified_year
     FROM users
     WHERE EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM now())
       AND EXTRACT(DAY FROM created_at) = EXTRACT(DAY FROM now())
       AND created_at <= now() - interval '1 year'`
  );

  for (const user of users) {
    // REAL BUG FOUND AND FIXED HERE, via direct testing: computing
    // years-since-signup via a fixed 365.25-day divisor is imprecise
    // against Postgres's own real calendar-year arithmetic (a real
    // user backdated exactly 2 real years computed as 1 year here,
    // confirmed directly). Real calendar-year subtraction is
    // unambiguous and matches how a real person would count it --
    // today's real year minus the real signup year, adjusted down by
    // one if this real year's exact month+day hasn't technically
    // happened yet (impossible here in practice, since the real SQL
    // WHERE clause above already only selects users whose real
    // signup month+day equals today's, but kept for real correctness
    // regardless).
    const signupDate = new Date(user.created_at);
    const now = new Date();
    let yearsSinceSignup = now.getFullYear() - signupDate.getFullYear();
    if (now.getMonth() < signupDate.getMonth() || (now.getMonth() === signupDate.getMonth() && now.getDate() < signupDate.getDate())) {
      yearsSinceSignup -= 1;
    }
    if (yearsSinceSignup < 1 || user.last_notified_year >= yearsSinceSignup) continue;

    try {
      await createNotification({
        userId: user.id,
        type: 'account_anniversary',
        title: `Happy ${yearsSinceSignup} year${yearsSinceSignup === 1 ? '' : 's'} with LEAP!`,
        body: `Thanks for being with us for ${yearsSinceSignup} year${yearsSinceSignup === 1 ? '' : 's'}. We appreciate you.`,
      });
      await db.query('UPDATE users SET last_anniversary_notified_year = $1 WHERE id = $2', [yearsSinceSignup, user.id]);
    } catch (err) {
      console.error('[loyalty-milestones] Failed to notify a real anniversary (non-fatal):', err.message);
    }
  }
}

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once a day, matching the real supplier-digest cadence

function startScheduledAnniversaryCheck() {
  const tick = async () => {
    try {
      await checkAccountAnniversaries();
    } catch (err) {
      console.error('[loyalty-milestones] Scheduled tick failed (non-fatal, will retry next interval):', err.message);
    }
  };
  tick();
  setInterval(tick, CHECK_INTERVAL_MS);
}

module.exports = { checkAccountAnniversaries, startScheduledAnniversaryCheck };
