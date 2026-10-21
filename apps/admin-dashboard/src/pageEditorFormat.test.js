import { describe, it, expect } from 'vitest';
import { bold, heading, bulletList, link } from './pageEditorFormat';

// The formatting buttons of the page editor, as pure text changes.
describe('bold', () => {
  it('wraps the selection and keeps it selected', () => { expect(bold('make this loud', 5, 9)).toEqual({ value: 'make **this** loud', start: 7, end: 11 }); });
  it('with nothing selected it writes the words "bold text" and selects them', () => { expect(bold('ab', 1, 1)).toEqual({ value: 'a**bold text**b', start: 3, end: 12 }); });
});
describe('heading', () => {
  it('puts "## " at the start of the line the cursor is in (not at the cursor)', () => { expect(heading('one\ntwo three\nfour', 8)).toEqual({ value: 'one\n## two three\nfour', start: 11, end: 11 }); expect(heading('first line', 3).value).toBe('## first line'); });
  it('a second press does nothing', () => { const once = heading('x', 0); expect(heading(once.value, 3).value).toBe('## x'); });
});
describe('bullet list', () => {
  it('puts "- " in front of every line the selection touches, and nothing else', () => {
    expect(bulletList('a\nb\nc\nd', 2, 5).value).toBe('a\n- b\n- c\nd'); expect(bulletList('only', 0, 4).value).toBe('- only');
  });
  it('lines that are already bullets are left alone', () => { expect(bulletList('- a\nb', 0, 5).value).toBe('- a\n- b'); expect(bulletList('* a', 0, 3).value).toBe('* a'); });
});
describe('link', () => {
  it('makes [selected words](https://) and selects the address part to type over', () => { const r = link('see terms here', 4, 9); expect(r.value).toBe('see [terms](https://) here'); expect(r.value.slice(r.start, r.end)).toBe('https://'); });
  it('with nothing selected it writes "link text"', () => { expect(link('', 0, 0).value).toBe('[link text](https://)'); });
});
