// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { makePng } from './testImages.js';

const require = createRequire(import.meta.url);
const rules = require('../../../services/api/src/modules/fitment/vehicleRules.js');
const images = require('../../../services/api/src/modules/uploads/imageRules.js');

describe('the vehicle field rules (shared by the manual form and the Excel import)', () => {
  it('CRITICAL: seats are a whole number from 1 to 12: text digits and Arabic digits are fine, 0, 13, 5.5 and words are not', () => {
    for (const ok of [1, 5, 12, '5', ' 6 ', '٥']) expect(rules.parseSeats(ok), String(ok)).toBeGreaterThan(0);
    expect(rules.parseSeats('٥')).toBe(5);
    for (const bad of [0, 13, 5.5, '5.5', 'five', '', null, undefined, -1, '1e1']) expect(rules.parseSeats(bad), String(bad)).toBeNull();
  });
  it('CRITICAL: a year is four digits from 1950 to next year, written in English or Arabic digits', () => {
    const next = new Date().getFullYear() + 1;
    expect(rules.parseYear(2024)).toBe(2024); expect(rules.parseYear('2024')).toBe(2024); expect(rules.parseYear('٢٠٢٤')).toBe(2024); expect(rules.parseYear(next)).toBe(next);
    for (const bad of [1949, next + 1, '24', 'abcd', '', null, 2024.5, '20245']) expect(rules.parseYear(bad), String(bad)).toBeNull();
  });
  it('texts are tidied to one line and compared without capitals or extra spaces', () => {
    expect(rules.cleanLine('  AWD \n  Flagship\t ')).toBe('AWD Flagship');
    expect(rules.nameKey('  Awd   FLAGSHIP ')).toBe('awd flagship');
  });
  const good = { name: 'AWD Flagship', nameAr: 'دفع كلي', nameZh: '全轮驱动', engine: '1.5T (365 kW)', engineAr: '1.5 لتر', engineZh: '1.5升', seats: 5 };
  it('CRITICAL: a version needs its name AND its engine in English, Arabic and Chinese, and seats', () => {
    expect(rules.validateVersionFields(good)).toEqual({ ok: true, value: good });
    for (const field of ['name', 'nameAr', 'nameZh', 'engine', 'engineAr', 'engineZh', 'seats']) {
      const missing = { ...good }; delete missing[field];
      const blank = { ...good, [field]: '   ' };
      expect(rules.validateVersionFields(missing).ok, `missing ${field}`).toBe(false);
      expect(rules.validateVersionFields(missing).field).toBe(field);
      expect(rules.validateVersionFields(blank).ok, `blank ${field}`).toBe(false);
    }
  });
  it('a version is refused with seats out of range, and with texts that are too long; texts and seats are tidied', () => {
    expect(rules.validateVersionFields({ ...good, seats: 13 }).field).toBe('seats');
    expect(rules.validateVersionFields({ ...good, name: 'x'.repeat(121) }).field).toBe('name');
    expect(rules.validateVersionFields({ ...good, engineZh: '长'.repeat(201) }).field).toBe('engineZh');
    expect(rules.validateVersionFields({ ...good, name: ' AWD   Flagship ', seats: '٦' }).value).toMatchObject({ name: 'AWD Flagship', seats: 6 });
    expect(rules.validateVersionFields(null).ok).toBe(false);
  });
  it('an optional Chinese name: not sent = unchanged (null), sent blank = refused (undefined), otherwise tidied', () => {
    expect(rules.optionalName(undefined)).toBeNull(); expect(rules.optionalName(null)).toBeNull();
    expect(rules.optionalName('   ')).toBeUndefined();
    expect(rules.optionalName(' 问界 ')).toBe('问界');
  });
});

describe('the photo rules of the vehicle and category door', () => {
  it('CRITICAL: the shortest side must be at least 400 px: 399 is refused, 400 and bigger are accepted, a long picture counts by its shortest side', () => {
    expect(images.MIN_CATALOG_DIMENSION_PX).toBe(400);
    const refused = images.inspectImage(makePng(399, 399));
    expect(refused.ok).toBe(false);
    expect(refused.error).toMatch(/399x399.*at least 400px/);
    for (const [w, h] of [[400, 400], [800, 800], [400, 1200], [1600, 400]]) expect(images.inspectImage(makePng(w, h)).ok, `${w}x${h}`).toBe(true);
    expect(images.inspectImage(makePng(300, 900)).ok).toBe(false);
  });
  it('the 400 px rule is a parameter of this check only: the 800 px rule the other doors use is still available and still refuses 400', () => {
    expect(images.inspectImage(makePng(400, 400), 800).ok).toBe(false);
    expect(images.inspectImage(makePng(800, 800), 800).ok).toBe(true);
  });
  it('what counts is what the bytes REALLY are: a text file, a damaged picture and a too-short file are refused', () => {
    expect(images.sniffMime(makePng(10, 10))).toBe('image/png');
    expect(images.inspectImage(Buffer.from('this is not a picture at all, just text')).ok).toBe(false);
    expect(images.inspectImage(makePng(500, 500).subarray(0, 40)).ok).toBe(false);
    expect(images.inspectImage(Buffer.from([1, 2, 3])).ok).toBe(false);
  });
});
