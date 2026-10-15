import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SYMPTOMS } from "./symptoms";

describe("shop by symptom", () => {
  it("every symptom has both languages, search words, and a unique id", () => {
    expect(SYMPTOMS).toHaveLength(8);
    expect(new Set(SYMPTOMS.map((s) => s.id)).size).toBe(8);
    for (const s of SYMPTOMS) {
      expect(s.en.trim()).not.toBe("");
      expect(/[\u0600-\u06FF]/.test(s.ar), s.id).toBe(true);
      expect(s.query.trim()).not.toBe("");
    }
  });

  it("CRITICAL: they are the SAME symptoms, with the SAME search words, as the mobile app (so both show the same results for the same complaint)", () => {
    const dart = fs.readFileSync(path.resolve(__dirname, "../../mobile/lib/features/catalog/shop_by_symptom_screen.dart"), "utf8");
    const rows = [...dart.matchAll(/labelEn: '((?:[^'\\]|\\.)*)', labelAr: '((?:[^'\\]|\\.)*)', icon: [\w.]+, searchQuery: '([^']*)'/g)]
      .map((m) => ({ en: m[1].replace(/\\'/g, "'"), ar: m[2], query: m[3] }));
    expect(rows).toHaveLength(8);
    expect(SYMPTOMS.map(({ en, ar, query }) => ({ en, ar, query }))).toEqual(rows);
  });
});
