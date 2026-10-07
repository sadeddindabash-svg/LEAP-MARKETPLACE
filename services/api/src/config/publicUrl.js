const { env } = require('./env');

// The address people OUTSIDE this computer use to reach the API (the QR on the parcel label, the button in the password reset email).
// It must be reachable from their phone: your public API domain in production, your PC's address (e.g. http://192.168.0.210:4000) to test on Wi-Fi.
// Defaults to http://localhost:<port>, which only works on this computer.
function publicBaseUrl() {
  return (process.env.PUBLIC_API_URL || `http://localhost:${env.port}`).replace(/\/$/, '');
}

module.exports = { publicBaseUrl };
