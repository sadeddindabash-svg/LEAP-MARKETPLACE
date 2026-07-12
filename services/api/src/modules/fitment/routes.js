const express = require('express');

/**
 * Fitment module — Year/Make/Model/Trim reference data (Phase 1, BUY-010).
 * VIN decoding (Phase 2, BUY-014) depends on a licensed data provider — see
 * SRS Section 11, Appendix item 3 — and is intentionally not stubbed here.
 */
const router = express.Router();

const PLACEHOLDER_VEHICLES = [
  { id: 'v1', make: 'BMW', model: '1 Hatchback (F20)', trim: '118d 2.0', yearsRange: '2015–2019' },
  { id: 'v2', make: 'Toyota', model: 'Camry (XV70)', trim: '2.5L SE', yearsRange: '2018–2023' },
  { id: 'v3', make: 'Honda', model: 'Civic (FC)', trim: '1.5L Turbo Sport', yearsRange: '2016–2021' },
];

router.get('/makes', (req, res) => {
  const makes = [...new Set(PLACEHOLDER_VEHICLES.map((v) => v.make))];
  res.json(makes);
});

router.get('/vehicles', (req, res) => {
  const { make } = req.query;
  const results = make ? PLACEHOLDER_VEHICLES.filter((v) => v.make === make) : PLACEHOLDER_VEHICLES;
  res.json(results);
});

module.exports = router;
