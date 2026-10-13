// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// The buyer app (Flutter) cannot be run where these tests run, so this guards the wiring by reading the sources: the server sends the year photo, the app's
// vehicle model reads it, and EVERY place that shows a vehicle uses the app's single rules: the picture is the YEAR photo, else the BRAND photo (models have
// no photo any more), and a one-year entry is written as just the year.
const root = path.resolve(import.meta.dirname, '../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const vehicle = read('apps/mobile/lib/models/vehicle.dart');
const garageScreen = read('apps/mobile/lib/features/garage/garage_screen.dart');
const homeScreen = read('apps/mobile/lib/features/home/home_screen.dart');
const pickerSheet = read('apps/mobile/lib/features/search/vehicle_filter_sheet.dart');
const garageRoutes = read('services/api/src/modules/garage/routes.js');
const code = (text) => text.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

describe('the vehicle YEAR photo and name reach the buyer app', () => {
  it('CRITICAL: the garage reply sends the year photo, and the app\'s Vehicle model reads and keeps it', () => {
    expect(garageRoutes).toMatch(/generationPhotoUrl: row\.generation_photo_url/);
    expect(garageRoutes).toMatch(/vg\.photo_url AS generation_photo_url/);
    expect(vehicle).toMatch(/final String\? generationPhotoUrl;/);
    expect(vehicle).toMatch(/generationPhotoUrl: json\['generationPhotoUrl'\] as String\?/);
    expect(vehicle).toMatch(/'generationPhotoUrl': generationPhotoUrl/);
  });

  it('CRITICAL: the picture rule lives in ONE place: the year photo, then the brand photo, never the model\'s; empty text counts as none', () => {
    const rule = vehicle.slice(vehicle.indexOf('String? get heroPhotoUrl'), vehicle.indexOf('String? get heroPhotoUrl') + 400);
    expect(rule.indexOf('generationPhotoUrl')).toBeGreaterThan(-1);
    expect(rule.indexOf('generationPhotoUrl')).toBeLessThan(rule.indexOf('brandPhotoUrl'));
    expect(rule).not.toMatch(/modelPhotoUrl/);
    expect(rule).toMatch(/isNotEmpty/);
  });

  it('CRITICAL: the garage card and the home "Shopping for" card both use that rule, and neither picks a photo itself (no model photo)', () => {
    for (const [name, text] of [['garage_screen', garageScreen], ['home_screen', homeScreen]]) {
      expect(code(text), name).toMatch(/\.heroPhotoUrl/);
      expect(code(text), `${name} must not pick the photo itself`).not.toMatch(/modelPhotoUrl/);
    }
  });

  it('CRITICAL: a one-year entry is written as just the year everywhere a vehicle year is listed (the garage sub-label and both picker labels)', () => {
    expect(vehicle).toMatch(/String generationDisplay\(String name, int yearStart, int\? yearEnd\)/);
    expect(vehicle).toMatch(/subLabel => generation\.trim\(\) == '\$year' \? '\$year'/);
    const picker = code(pickerSheet);
    expect((picker.match(/generationDisplay\(/g) || []).length).toBeGreaterThanOrEqual(2);              // the tile label and the selection label
    expect(picker).not.toMatch(/–present/);                                                              // no hand-built "2021–present" text left in the picker
  });
});
