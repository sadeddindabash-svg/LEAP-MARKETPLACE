/**
 * Makes a rejected promise from an ASYNC Express route handler reach the error handler (a 500 response) instead of crashing the whole server.
 *
 * WHY: this backend runs Express 4, which does not catch an error thrown inside an `async` handler. Under Node 15+ an unhandled rejection
 * ENDS THE PROCESS, so a single bad query in one route (for example a column that a forgotten migration never added) used to stop the entire
 * backend, and every portal then looked "not loading". Express 5 does this natively; until the upgrade, this does the same thing (it is the
 * same small patch the well-known `express-async-errors` package makes, kept here so there is no new dependency).
 *
 * Install it ONCE, before any request is served. Safe to call twice.
 */
function installAsyncErrorHandling(express = require('express')) {
  const Layer = require('express/lib/router/layer');
  if (Layer.prototype.handle_request.__asyncSafe) return false;
  Layer.prototype.handle_request = function handleRequestAsyncSafe(req, res, next) {
    const fn = this.handle;
    if (fn.length > 3) return next(); // an error-handling function is not run for a normal request
    try {
      const result = fn(req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
    } catch (err) {
      next(err);
    }
  };
  Layer.prototype.handle_request.__asyncSafe = true;
  return true;
}

module.exports = { installAsyncErrorHandling };
