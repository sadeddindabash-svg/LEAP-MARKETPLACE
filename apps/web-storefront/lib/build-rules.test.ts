import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Rules that `next build` enforces but `next dev` and the other tests do NOT, found when the production build was first run: a component that reads the page's query string
// (useSearchParams) must sit inside a <Suspense> boundary, or every page that contains it fails to build (and so the site cannot be deployed).
const ROOT = join(__dirname, "..");
function files(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === "node_modules" || name === ".next") continue;
    if (statSync(full).isDirectory()) files(full, found);
    else found.push(full);
  }
  return found;
}
const source = (path: string) => readFileSync(path, "utf-8");

describe("what the production build requires", () => {
  it("CRITICAL: every page that reads the query string itself wraps that in a <Suspense> boundary", () => {
    const pages = files(join(ROOT, "app")).filter((f) => /[\\/]page\.tsx$/.test(f) && source(f).includes("useSearchParams"));
    expect(pages.length).toBeGreaterThan(5);                                   // the rule is really being applied to the pages that read it
    const without = pages.filter((f) => !source(f).includes("<Suspense")).map((f) => f.replace(ROOT, ""));
    expect(without).toEqual([]);
  });
  it("CRITICAL: the language switcher (in the header of EVERY page) is inside a <Suspense>; without it no page can be built", () => {
    expect(source(join(ROOT, "components/LanguageSwitcher.tsx"))).toContain("useSearchParams");
    expect(source(join(ROOT, "components/SiteHeader.tsx"))).toMatch(/<Suspense fallback=\{null\}>\s*<LanguageSwitcher \/>\s*<\/Suspense>/);
  });
  it("a page file exports only the page (and the settings Next knows): anything else breaks the build", () => {
    const allowed = new Set(["default", "metadata", "generateMetadata", "dynamic", "revalidate", "viewport", "generateViewport", "generateStaticParams", "dynamicParams", "fetchCache", "runtime", "preferredRegion", "maxDuration"]);
    const offenders: string[] = [];
    for (const f of files(join(ROOT, "app")).filter((p) => /[\\/](page|layout|error|not-found)\.tsx$/.test(p))) {
      for (const m of source(f).matchAll(/^export\s+(?:async\s+)?(?:function|const|class|let|var)\s+(\w+)/gm)) if (!allowed.has(m[1])) offenders.push(`${f.replace(ROOT, "")}: ${m[1]}`);
    }
    expect(offenders).toEqual([]);
  });
});
