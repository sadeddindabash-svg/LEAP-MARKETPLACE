// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Only the PUBLIC storefront belongs in search results. Every other web page of the project (the three portals, which are behind a login, and the web builds of the
// two phone apps, which would be duplicates of the storefront) must tell search engines to stay out.
const APPS = path.resolve(import.meta.dirname, '../..');
const PAGES = ['admin-dashboard/index.html', 'supplier-portal/index.html', 'hub-portal/index.html', 'mobile/web/index.html', 'hub-mobile/web/index.html'];

describe('web pages that must NOT appear in search results', () => {
  for (const page of PAGES) {
    it(`CRITICAL: ${page} says noindex, nofollow, once, inside the head`, () => {
      const html = fs.readFileSync(path.join(APPS, page), 'utf8');
      const tags = html.match(/<meta\s+name="robots"\s+content="([^"]*)"\s*\/?>/gi) || [];
      expect(tags).toHaveLength(1);
      expect(tags[0]).toMatch(/noindex/);
      expect(tags[0]).toMatch(/nofollow/);
      const head = html.slice(html.search(/<head>/i), html.search(/<\/head>/i));
      expect(head).toContain(tags[0]);
    });
  }

  it('the storefront is the only web app that is NOT told to stay out (it has its own, per-page rules)', () => {
    const storefrontLayout = fs.readFileSync(path.join(APPS, 'web-storefront/app/layout.tsx'), 'utf8');
    expect(storefrontLayout).not.toMatch(/noindex/);
    expect(fs.existsSync(path.join(APPS, 'web-storefront/app/robots.ts'))).toBe(true);
    expect(fs.existsSync(path.join(APPS, 'web-storefront/app/sitemap.ts'))).toBe(true);
  });
});
