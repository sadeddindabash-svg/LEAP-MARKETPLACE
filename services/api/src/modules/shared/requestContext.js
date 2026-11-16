// The request a price is being worked out for (patch-delivery-prices): lets the pricing engine find the buyer's country (their default address, else their
// internet address, else the fallback country) without every caller passing it. Set for every request by one line in index.js.
const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

function middleware(req, res, next) {
  storage.run({ req }, () => next());
}

// The buyer's country for the current request, worked out once per request; null outside a request (scheduled jobs).
async function currentDestinationIsoCode() {
  const store = storage.getStore();
  if (!store || !store.req) return null;
  if (!store.destination) {
    const { resolveDestinationIsoCode } = require('../deliveryEstimate/engine');
    store.destination = resolveDestinationIsoCode(store.req).catch(() => null);
  }
  return store.destination;
}

module.exports = { middleware, currentDestinationIsoCode };
