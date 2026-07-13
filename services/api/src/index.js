const express = require('express');
const cors = require('cors');
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

assertRequiredEnvInProduction();

const app = express();
app.use(cors());
app.use(express.json());

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

app.use(notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
  app.listen(env.port, () => {
    console.log(`Leap API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

module.exports = app;
