// Real, curated ISO 3166-1 alpha-2 code -> common name list, confirmed
// necessary rather than reusing a generic ISO library: those return
// formal, official names ("People's Republic of China") that would
// never match this app's own already-established, casual real country
// naming convention (suppliers.country already uses "China", "Jordan"
// -- not formal names). Covers the Middle East/North Africa region
// comprehensively (this app's actual real market) plus major global
// countries, deliberately not every country in the world.

const COUNTRIES = [
  { isoCode: 'JO', name: 'Jordan' },
  { isoCode: 'CN', name: 'China' },
  { isoCode: 'SA', name: 'Saudi Arabia' },
  { isoCode: 'AE', name: 'United Arab Emirates' },
  { isoCode: 'KW', name: 'Kuwait' },
  { isoCode: 'QA', name: 'Qatar' },
  { isoCode: 'BH', name: 'Bahrain' },
  { isoCode: 'OM', name: 'Oman' },
  { isoCode: 'LB', name: 'Lebanon' },
  { isoCode: 'SY', name: 'Syria' },
  { isoCode: 'PS', name: 'Palestine' },
  { isoCode: 'IQ', name: 'Iraq' },
  { isoCode: 'EG', name: 'Egypt' },
  { isoCode: 'LY', name: 'Libya' },
  { isoCode: 'TN', name: 'Tunisia' },
  { isoCode: 'DZ', name: 'Algeria' },
  { isoCode: 'MA', name: 'Morocco' },
  { isoCode: 'SD', name: 'Sudan' },
  { isoCode: 'YE', name: 'Yemen' },
  { isoCode: 'TR', name: 'Turkey' },
  { isoCode: 'US', name: 'United States' },
  { isoCode: 'GB', name: 'United Kingdom' },
  { isoCode: 'DE', name: 'Germany' },
  { isoCode: 'FR', name: 'France' },
  { isoCode: 'IN', name: 'India' },
  { isoCode: 'VN', name: 'Vietnam' },
  { isoCode: 'TH', name: 'Thailand' },
  { isoCode: 'MY', name: 'Malaysia' },
];

const BY_ISO_CODE = Object.fromEntries(COUNTRIES.map((c) => [c.isoCode, c.name]));
const BY_NAME = Object.fromEntries(COUNTRIES.map((c) => [c.name, c.isoCode]));

function nameForIsoCode(isoCode) {
  return BY_ISO_CODE[isoCode] || null;
}

function isoCodeForName(name) {
  return BY_NAME[name] || null;
}

module.exports = { COUNTRIES, nameForIsoCode, isoCodeForName };
