const express = require('express');
const { LAUNCH_MARKETS, COMPLIANCE_HOLD_COUNTRY_CODES, getMarketByCountryCode } = require('../../config/markets');

/**
 * Config module — exposes launch-market data so the mobile app, admin
 * dashboard, and supplier portal don't each hardcode their own copy.
 */
const router = express.Router();

// GET /config/markets -> the confirmed 40-country Phase 1 launch list
router.get('/markets', (req, res) => {
  res.json({
    markets: LAUNCH_MARKETS,
    complianceHoldCountryCodes: Array.from(COMPLIANCE_HOLD_COUNTRY_CODES),
  });
});

// GET /config/markets/:countryCode -> a single market's currency/locale
router.get('/markets/:countryCode', (req, res) => {
  const market = getMarketByCountryCode(req.params.countryCode.toUpperCase());
  if (!market) return res.status(404).json({ error: 'Market not found' });
  res.json({
    ...market,
    complianceHold: COMPLIANCE_HOLD_COUNTRY_CODES.has(market.countryCode),
  });
});

module.exports = router;
