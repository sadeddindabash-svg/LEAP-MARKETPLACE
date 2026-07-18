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
const notificationsRoutes = require('./modules/notifications/routes');
const referralsRoutes = require('./modules/referrals/routes');
const promoCodesRoutes = require('./modules/promo-codes/routes');
const adminUsersRoutes = require('./modules/admin-users/routes');
const platformSettingsRoutes = require('./modules/platform-settings/routes');
const payoutsRoutes = require('./modules/payouts/routes');
const reviewsRoutes = require('./modules/reviews/routes');
const webhooksRoutes = require('./modules/webhooks/routes');
const pricingRoutes = require('./modules/pricing/routes');

assertRequiredEnvInProduction();

const app = express();
app.use(cors());
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
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
app.use('/notifications', notificationsRoutes);
app.use('/referrals', referralsRoutes);
app.use('/promo-codes', promoCodesRoutes);
app.use('/admin-users', adminUsersRoutes);
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
}

module.exports = app;
