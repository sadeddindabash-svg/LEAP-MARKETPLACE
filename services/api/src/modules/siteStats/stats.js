// The four real totals shown on the storefront's home page. Every number is counted, never taken from the length of a list that was fetched (which is how "27 parts" used to appear):
//   parts      the parts a buyer can find: products that are active
//   brands     the vehicle brands in the catalog
//   models     the vehicle models in the catalog
//   countries  the countries the shop delivers to, live: the different countries in Delivery Rules' destination groups (each counted once)
const { LAUNCH_MARKETS, COMPLIANCE_HOLD_COUNTRY_CODES } = require('../../config/markets');

const count = async (q, sql) => Number((await q.query(sql)).rows[0].n);
// "Countries" on the home page (confirmed with the person): counted live from the destination country groups of Delivery Rules,
// a country in two groups counted once. 0 when there are no groups yet (or before migration 070).
async function countDeliveryCountries(q) {
  try { return await count(q, 'SELECT count(DISTINCT upper(iso_code)) AS n FROM country_group_members'); } catch (err) { return 0; }
}

async function loadSiteStats(q) {
  const [parts, brands, models] = await Promise.all([
    count(q, "SELECT count(*) AS n FROM products WHERE status = 'active'"),
    count(q, 'SELECT count(*) AS n FROM vehicle_brands'),
    count(q, 'SELECT count(*) AS n FROM vehicle_models'),
  ]);
  const countries = await countDeliveryCountries(q);      // live: Delivery Rules > destination groups
  return { parts, brands, models, countries };
}

module.exports = { loadSiteStats };
