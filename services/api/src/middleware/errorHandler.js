// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  const env = require('../config/env');
  res.status(status).json({
    error: err.publicMessage || 'Internal server error',
    // Real, temporary diagnostic aid (dev only) -- surfaces the
    // actual underlying error message so a genuinely unexpected
    // failure can be diagnosed directly, rather than guessed at.
    // Never included outside development.
    ...(env.nodeEnv === 'development' && !err.publicMessage ? { debugMessage: err.message, debugStack: err.stack } : {}),
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFoundHandler };
