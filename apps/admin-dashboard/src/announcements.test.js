// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { MAX_ANNOUNCEMENTS, MAX_LENGTH, validateAnnouncements, parseStored } = require('../../../services/api/src/modules/platform-settings/announcements.js');

describe('what an admin may save as home page announcements', () => {
  it('CRITICAL: up to 5 are accepted, the 6th is refused, and the order is kept', () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ en: `Line ${i + 1}`, ar: `سطر ${i + 1}` }));
    const ok = validateAnnouncements(five);
    expect(ok.ok).toBe(true);
    expect(ok.value.map((a) => a.en)).toEqual(['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5']);
    expect(MAX_ANNOUNCEMENTS).toBe(5);
    const six = validateAnnouncements([...five, { en: 'Line 6', ar: '' }]);
    expect(six).toEqual({ ok: false, error: 'You can have up to 5 announcements' });
  });
  it('an empty list is fine: it switches the bar off', () => {
    expect(validateAnnouncements([])).toEqual({ ok: true, value: [] });
  });
  it('CRITICAL: English is required; Arabic may be empty or missing (the Arabic site then shows the English)', () => {
    expect(validateAnnouncements([{ en: 'Hello', ar: '' }]).value).toEqual([{ en: 'Hello', ar: '' }]);
    expect(validateAnnouncements([{ en: 'Hello' }]).value).toEqual([{ en: 'Hello', ar: '' }]);
    for (const bad of [{ en: '', ar: 'مرحبا' }, { en: '   ', ar: 'مرحبا' }, { ar: 'مرحبا' }, { en: 5 }, null, 'text', { en: 'x', ar: 5 }]) {
      expect(validateAnnouncements([bad]).ok, JSON.stringify(bad)).toBe(false);
    }
  });
  it('CRITICAL: a line is plain text of at most 150 characters: new lines and tabs become spaces, spaces are tidied, and 151 is refused', () => {
    expect(validateAnnouncements([{ en: '  Free\n\n delivery\tover   $200  ', ar: '' }]).value[0].en).toBe('Free delivery over $200');
    expect(validateAnnouncements([{ en: 'x'.repeat(MAX_LENGTH), ar: '' }]).ok).toBe(true);
    expect(validateAnnouncements([{ en: 'x'.repeat(MAX_LENGTH + 1), ar: '' }]).ok).toBe(false);
    expect(validateAnnouncements([{ en: 'ok', ar: 'ع'.repeat(MAX_LENGTH + 1) }]).ok).toBe(false);
  });
  it('anything that is not a list is refused', () => {
    for (const bad of [undefined, null, 'text', 5, {}, { en: 'x' }]) expect(validateAnnouncements(bad).ok, String(bad)).toBe(false);
  });
});

describe('reading the stored value back', () => {
  it('CRITICAL: damaged or unexpected data means "no announcements", never an error (the home page must always load)', () => {
    for (const bad of ['', 'not json', '{"en":"x"}', 'null', '5', '"text"']) expect(parseStored(bad), bad).toEqual([]);
  });
  it('keeps good lines in order, drops lines without English, tidies, and never returns more than 5', () => {
    const raw = JSON.stringify([{ en: ' One ', ar: ' واحد ' }, { en: '', ar: 'x' }, { ar: 'y' }, { en: 'Two' }, ...Array.from({ length: 6 }, (_, i) => ({ en: `More ${i}`, ar: '' }))]);
    const read = parseStored(raw);
    expect(read).toHaveLength(5);
    expect(read.slice(0, 2)).toEqual([{ en: 'One', ar: 'واحد' }, { en: 'Two', ar: '' }]);
  });
});
