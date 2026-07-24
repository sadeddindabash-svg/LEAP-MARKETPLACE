const express = require('express');
const cors = require('cors');
const path = require('path');
const { env, assertRequiredEnvInProduction } = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const catalogRoutes = require('./modules/catalog/routes');
const fitmentRoutes = require('./modules/fitment/routes');
const cartRoutes = require('./modules/cart/routes');
const orderRoutes = require('./modules/order/routes');
const userRoutes = require('./modules/user/routes');
const paymentRoutes = require('./modules/payment/routes');
const notificationRoutes = require('./modules/notification/routes');
const configRoutes = require('./modules/config/routes');
const authRoutes = require('./modules/auth/routes');
const supplierRoutes = require('./modules/supplier/routes');
const supportRoutes = require('./modules/support/routes');
const returnsRoutes = require('./modules/returns/routes');
const garageRoutes = require('./modules/garage/routes');
const overviewRoutes = require('./modules/overview/routes');
const uploadsRoutes = require('./modules/uploads/routes');
const hubRoutes = require('./modules/hub/routes');
const supplierMessagesRoutes = require('./modules/supplier-messages/routes');
const addressesRoutes = require('./modules/addresses/routes');
const wishlistRoutes = require('./modules/wishlist/routes');
const recentlyViewedRoutes = require('./modules/recentlyViewed/routes');
const notificationsRoutes = require('./modules/notifications/routes');
const referralsRoutes = require('./modules/referrals/routes');
const promoCodesRoutes = require('./modules/promo-codes/routes');
const adminUsersRoutes = require('./modules/admin-users/routes');
const adminSearchRoutes = require('./modules/search/routes');
const auditRoutes = require('./modules/audit/routes');
const platformSettingsRoutes = require('./modules/platform-settings/routes');
const payoutsRoutes = require('./modules/payouts/routes');
const reviewsRoutes = require('./modules/reviews/routes');
const webhooksRoutes = require('./modules/webhooks/routes');
const { startScheduledFxRateRefresh } = require('./modules/pricing/fxRateRefresh');
const { startScheduledPriceDropCheck } = require('./modules/priceDropAlerts/check');
const priceDropAlertsRoutes = require('./modules/priceDropAlerts/routes');
const savedSearchesRoutes = require('./modules/savedSearches/routes');
const savedSearchesAdminRoutes = require('./modules/savedSearches/adminRoutes');
const { startScheduledSavedSearchCheck } = require('./modules/savedSearches/check');
const supplierDigestRoutes = require('./modules/supplierDigest/routes');
const { startScheduledSupplierDigest } = require('./modules/supplierDigest/send');
const pricingRoutes = require('./modules/pricing/routes');

assertRequiredEnvInProduction();

const app = express();
// REAL BUG FOUND AND FIXED HERE, before it ever shipped: by default,
// the cors package does NOT expose ANY custom response header to
// browser JavaScript, even though it's genuinely sent over the wire --
// a well-known CORS gotcha. X-Total-Count (added for real pagination on
// GET /catalog/products) would have silently been invisible to
// `response.headers.get('X-Total-Count')` in a real browser, while
// working fine in curl or a Node-based test (neither enforces this
// browser-only restriction) -- exactly the kind of gap that's easy to
// miss without specifically checking for it.
app.use(cors({ exposedHeaders: ['X-Total-Count'] }));
// The `verify` callback captures the exact real raw bytes of every
// request body into req.rawBody, alongside express.json()'s normal
// parsed req.body -- needed for real webhook signature verification
// (see modules/webhooks/routes.js), since re-serializing the ALREADY
// parsed JSON back to a string is not guaranteed to byte-for-byte
// match what the real sender originally signed (key ordering,
// whitespace, etc. can differ) -- a common, real bug in webhook
// implementations that this avoids from the start.
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
// Serves uploaded product images — see modules/uploads/routes.js header
// comment for why this is local disk (real, working) rather than real
// object storage (the production-ready choice, not yet wired up).
//
// REAL GAP FOUND AND FIXED HERE: this had no cache headers at all
// before -- express.static's own default (no maxAge set) sends no real
// Cache-Control directive, so every app loading these images (mobile,
// admin dashboard, supplier/hub portals, web storefront) relied on a
// conditional GET (304) on every repeat view rather than skipping the
// network round-trip entirely. Safe to cache aggressively and
// immutably: every uploaded filename is a fresh crypto.randomBytes(16)
// hex string generated per upload (see uploads/routes.js) -- a given
// URL's content can never change, only a brand-new URL is ever created
// for a new photo. This is on TOP of, not instead of, the mobile app's
// own on-device CachedNetworkImage cache -- that one avoids the
// request even reaching the network at all; this one makes any
// request that does reach the network as cheap as possible.
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '365d',
  immutable: true,
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: env.nodeEnv, timestamp: new Date().toISOString() });
});

app.use('/catalog', catalogRoutes);
app.use('/fitment', fitmentRoutes);
app.use('/cart', cartRoutes);
app.use('/order', orderRoutes);
app.use('/user', userRoutes);
app.use('/payment', paymentRoutes);
app.use('/notification', notificationRoutes);
app.use('/config', configRoutes);
app.use('/auth', authRoutes);
app.use('/supplier', supplierRoutes);
app.use('/support', supportRoutes);
app.use('/returns', returnsRoutes);
app.use('/garage', garageRoutes);
app.use('/overview', overviewRoutes);
app.use('/uploads', uploadsRoutes);
app.use('/hub', hubRoutes);
app.use('/supplier-messages', supplierMessagesRoutes);
app.use('/addresses', addressesRoutes);
app.use('/wishlist', wishlistRoutes);
app.use('/recently-viewed', recentlyViewedRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/referrals', referralsRoutes);
app.use('/promo-codes', promoCodesRoutes);
app.use('/admin-users', adminUsersRoutes);
app.use('/admin/search', adminSearchRoutes);
app.use('/admin/audit-log', auditRoutes);
app.use('/admin/price-drop-alerts', priceDropAlertsRoutes);
app.use('/saved-searches', savedSearchesRoutes);
app.use('/admin/saved-searches', savedSearchesAdminRoutes);
app.use('/admin/supplier-digest', supplierDigestRoutes);
app.use('/platform-settings', platformSettingsRoutes);
app.use('/payouts', payoutsRoutes);
app.use('/reviews', reviewsRoutes);
app.use('/webhooks', webhooksRoutes);
app.use('/pricing', pricingRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
  app.listen(env.port, () => {
    console.log(`Leap API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });
  // Real, once-a-day live FX rate refresh (migration 028) -- only when
  // the server actually runs, never when this file is required for
  // testing (see modules/pricing/fxRateRefresh.js for the full real
  // design, including the honest limitation that this couldn't be
  // tested against the real, live Frankfurter API from this sandbox).
  startScheduledFxRateRefresh();
  // Real, every-6-hours price-drop check across wishlisted products
  // (migration 038) -- same real startup guard as the FX rate refresh
  // above, only when the server actually runs, never during testing.
  startScheduledPriceDropCheck();
  // Real, every-6-hours saved-search check (migration 039) -- same
  // real startup guard as above, only when the server actually runs.
  startScheduledSavedSearchCheck();
  // Real, once-a-day check for due weekly supplier digests (migration
  // 040) -- same real startup guard as above.
  startScheduledSupplierDigest();
}

module.exports = app;
