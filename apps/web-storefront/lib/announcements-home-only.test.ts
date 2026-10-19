import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// The announcement line belongs to the HOME page and nowhere else. These read the source, so putting it back in the header (where it used to be, on every page) fails here.
const ROOT = join(__dirname, "..");
function files(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files(full, found); else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name)) found.push(full);
  }
  return found;
}

describe("the announcement line is on the home page only", () => {
  it("CRITICAL: the home page shows it", () => {
    const home = readFileSync(join(ROOT, "app/page.tsx"), "utf-8");
    expect(home).toContain("<AnnouncementBar");
    expect(home).toContain("fetchAnnouncements()");
  });
  it("CRITICAL: no other page, layout or component draws it: the header does not, and nothing else imports it", () => {
    const users = [...files(join(ROOT, "app")), ...files(join(ROOT, "components"))].filter((f) => readFileSync(f, "utf-8").includes("AnnouncementBar") && !f.endsWith("AnnouncementBar.tsx"));
    expect(users.map((f) => f.replace(ROOT, ""))).toEqual([join("/app", "page.tsx")]);
    const header = readFileSync(join(ROOT, "components/SiteHeader.tsx"), "utf-8");
    expect(header).not.toMatch(/announce/i);
    expect(header).not.toContain("bg-signal text-sm");                              // the old yellow strip
  });
  it("the old fixed texts are gone from the website's dictionary (they are edited in the admin portal now)", () => {
    expect(readFileSync(join(ROOT, "lib/i18n.ts"), "utf-8")).not.toMatch(/announce_warehouse|announce_shipping/);
  });
});
