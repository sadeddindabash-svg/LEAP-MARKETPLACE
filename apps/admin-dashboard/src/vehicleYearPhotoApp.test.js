// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// The buyer app (Flutter) cannot be run where these tests run, so this guards the wiring of the year photo by reading the sources: the server sends it, the
// app's vehicle model reads it, and BOTH screens that show a vehicle picture use the one rule (year, then model, then brand) instead of their own old chain.
const root = path.resolve(import.meta.dirname, '../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const vehicle = read('apps/mobile/lib/models/vehicle.dart');
const garageScreen = read('apps/mobile/lib/features/garage/garage_screen.dart');
const homeScreen = read('apps/mobile/lib/features/home/home_screen.dart');
const garageRoutes = read('services/api/src/modules/garage/routes.js');
const code = (text) => text.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

describe('the vehicle YEAR photo reaches the buyer app', () => {
  it('CRITICAL: the garage reply sends it, and the app\'s Vehicle model reads and keeps it', () => {
    expect(garageRoutes).toMatch(/generationPhotoUrl: row\.generation_photo_url/);
    expect(garageRoutes).toMatch(/vg\.photo_url AS generation_photo_url/);
    expect(vehicle).toMatch(/final String\? generationPhotoUrl;/);
    expect(vehicle).toMatch(/generationPhotoUrl: json\['generationPhotoUrl'\] as String\?/);
    expect(vehicle).toMatch(/'generationPhotoUrl': generationPhotoUrl/);
  });

  it('CRITICAL: the picture rule lives in ONE place, year then model then brand, ignoring empty text', () => {
    const rule = vehicle.slice(vehicle.indexOf('String? get heroPhotoUrl'));
    expect(rule.indexOf('generationPhotoUrl')).toBeLessThan(rule.indexOf('modelPhotoUrl'));
    expect(rule.indexOf('modelPhotoUrl')).toBeLessThan(rule.indexOf('brandPhotoUrl'));
    expect(rule).toMatch(/isNotEmpty/);
  });

  it('CRITICAL: the garage card and the home screen\'s "Shopping for" card both use that rule, and neither still has the old model-then-brand chain', () => {
    expect(code(garageScreen)).toMatch(/\.heroPhotoUrl/);
    expect(code(homeScreen)).toMatch(/\.heroPhotoUrl/);
    for (const [name, text] of [['garage_screen', garageScreen], ['home_screen', homeScreen]]) {
      expect(code(text), `${name} must not pick the photo itself any more`).not.toMatch(/modelPhotoUrl\s*\?\?\s*\w+\.brandPhotoUrl/);
    }
  });
});
