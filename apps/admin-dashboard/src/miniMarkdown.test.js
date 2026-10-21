import { describe, it, expect } from 'vitest';
import { parseMarkdown, parseInline, safeHref } from './miniMarkdown';

// The admin portal's copy of the website's text formatting (used for the preview). The storefront has a test that checks both read the same texts the same way; these are the basics.
describe('the preview\'s reading of a text', () => {
  it('headings, paragraphs, lists, bold and links', () => {
    expect(parseMarkdown('## Head\nText **bold**\n\n- a\n- b\n\n1. x').map((b) => b.t)).toEqual(['h2', 'p', 'ul', 'ol']);
    expect(parseInline('see [terms](/terms-conditions)')).toEqual([{ t: 'text', text: 'see ' }, { t: 'link', text: 'terms', href: '/terms-conditions' }]);
  });
  it('SAFETY: no unsafe link and no HTML ever', () => {
    for (const h of ['javascript:alert(1)', 'data:text/html,x', '//evil.com', 'vbscript:x']) expect(safeHref(h), h).toBeNull();
    expect(parseMarkdown('<script>alert(1)</script>')[0].lines[0].every((i) => i.t === 'text')).toBe(true);
  });
});
