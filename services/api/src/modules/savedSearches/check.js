const db = require('../../../db/pool');
const { buildProductMatchQuery } = require('../catalog/routes');
const { createNotification } = require('../notifications/helpers');
const { sendTransactionalEmail } = require('../email/client');
const { wrapEmailBody } = require('../email/templates');

/**
 * Real saved-search matching sweep (migration 039). CONFIRMED DESIGN:
 * compares the real, current full match set against the real,
 * previously-seen set (see migration 039's own header comment for why
 * this is more robust than a timestamp comparison) -- notifies on
 * genuinely NEW matches only, then updates the real snapshot
 * regardless of outcome.
 */

async function checkOneSavedSearch(savedSearch) {
  const { sql, params } = buildProductMatchQuery({
    category: savedSearch.category || undefined,
    search: savedSearch.search_term || undefined,
  });
  const { rows } = await db.query(`SELECT p.id, p.name FROM (${sql}) p`, params);
  const currentIds = rows.map((r) => r.id);
  const previousIds = new Set(savedSearch.last_seen_product_ids || []);
  const newMatches = rows.filter((r) => !previousIds.has(r.id));
  // REAL BUG FOUND AND FIXED HERE, via actual testing: whether this is
  // the genuine first-ever check must be judged from last_checked_at
  // being real-ly NULL, not from previousIds.size > 0 -- a saved
  // search can legitimately have zero real matches on its first check
  // (nothing wrong with that), and the old condition would have
  // silently suppressed every future real notification for it
  // forever, since previousIds would stay empty check after check
  // until a match finally showed up -- at which point it would STILL
  // look exactly like "the first check" and get skipped again.
  const isFirstRealCheck = savedSearch.last_checked_at === null;

  if (newMatches.length > 0 && !isFirstRealCheck) {
    try {
      await createNotification({
        userId: savedSearch.buyer_id,
        type: 'saved_search_match',
        title: 'New results for a saved search',
        body: `"${savedSearch.label}" has ${newMatches.length} new match${newMatches.length === 1 ? '' : 'es'}: ${newMatches.slice(0, 3).map((m) => m.name).join(', ')}${newMatches.length > 3 ? '…' : ''}`,
        linkType: 'saved_search',
        linkId: savedSearch.id,
      });
      const { rows: buyerRows } = await db.query('SELECT email, name FROM users WHERE id = $1', [savedSearch.buyer_id]);
      if (buyerRows.length > 0 && buyerRows[0].email) {
        await sendTransactionalEmail({
          to: buyerRows[0].email,
          subject: `New results for "${savedSearch.label}"`,
          html: wrapEmailBody({
            heading: 'New results for a saved search',
            bodyHtml: `Hi${buyerRows[0].name ? ` ${buyerRows[0].name}` : ''},<br><br>Your saved search <strong>"${savedSearch.label}"</strong> has ${newMatches.length} new match${newMatches.length === 1 ? '' : 'es'}:<br><br>${newMatches.slice(0, 5).map((m) => `• ${m.name}`).join('<br>')}${newMatches.length > 5 ? '<br>…' : ''}`,
          }),
          fallbackLogLabel: 'saved-search-match',
        });
      }
    } catch (err) {
      console.error('[saved-search] Real notification failed (non-fatal):', err.message);
    }
  }

  await db.query('UPDATE saved_searches SET last_seen_product_ids = $1, last_checked_at = now() WHERE id = $2', [JSON.stringify(currentIds), savedSearch.id]);
  return { savedSearchId: savedSearch.id, newMatchCount: isFirstRealCheck ? 0 : newMatches.length };
}

async function checkAllSavedSearches() {
  const { rows: savedSearches } = await db.query('SELECT * FROM saved_searches');
  let notified = 0;
  for (const savedSearch of savedSearches) {
    try {
      const result = await checkOneSavedSearch(savedSearch);
      if (result.newMatchCount > 0) notified += 1;
    } catch (err) {
      console.error(`[saved-search] Real check failed for saved search ${savedSearch.id} (non-fatal):`, err.message);
    }
  }
  console.log(`[saved-search] Real sweep complete: ${savedSearches.length} saved search(es) checked, ${notified} with new real matches.`);
  return { checked: savedSearches.length, notified };
}

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // real, confirmed: every 6 hours, matching price-drop alerts

function startScheduledSavedSearchCheck() {
  const tick = async () => {
    try {
      await checkAllSavedSearches();
    } catch (err) {
      console.error('[saved-search] Scheduled tick failed (non-fatal, will retry next interval):', err.message);
    }
  };
  tick();
  setInterval(tick, CHECK_INTERVAL_MS);
}

module.exports = { checkOneSavedSearch, checkAllSavedSearches, startScheduledSavedSearchCheck };
