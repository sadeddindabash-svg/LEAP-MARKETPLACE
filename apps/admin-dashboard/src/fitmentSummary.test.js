import { describe, it, expect } from 'vitest';
import { fitmentModelName, yearRanges, formatRanges, summarizeFitment } from './fitmentSummary';

// What a part fits, summarised for the admin: the same grouping the server does for buyers (services/api/test/productFitGroups.test.js).
const row = (brandName, modelName, year, generationId = 'g1') => ({ brandName, modelName, year, generationId, label: `${brandName} ${modelName} (G) · ${year}` });

describe('the name of the model a row is for', () => {
  it('is brand and model when the row has them, otherwise read from the label (with or without the generation), otherwise unknown', () => {
    expect(fitmentModelName(row('BYD', 'Seal', 2022))).toBe('BYD Seal'); expect(fitmentModelName({ label: 'BYD Seal (Seal 2022-2024) · 2022' })).toBe('BYD Seal'); expect(fitmentModelName({ label: 'Geely Coolray · 2021' })).toBe('Geely Coolray');
    for (const bad of [null, undefined, {}, { label: 'nonsense' }, { label: 5 }]) expect(fitmentModelName(bad)).toBeNull();
  });
});
describe('years as ranges', () => {
  it('years that follow each other are one range; the others stay apart; duplicates and bad values are dropped', () => {
    expect(yearRanges([2022, 2023, 2024, 2026])).toEqual([[2022, 2024], [2026, 2026]]); expect(yearRanges([2024, 2022, 2023, 2023])).toEqual([[2022, 2024]]); expect(yearRanges([NaN, null, 'x', 2022])).toEqual([[2022, 2022]]); expect(yearRanges([])).toEqual([]);
    expect(formatRanges([[2020, 2021], [2023, 2023], [2025, 2027]])).toBe('2020–2021, 2023, 2025–2027');
  });
});
describe('the summary of a part\'s fitment', () => {
  it('groups by model in the order added, merges years, counts models and vehicles', () => {
    const s = summarizeFitment([row('BYD', 'Seal', 2022), row('Toyota', 'Camry', 2020), row('BYD', 'Seal', 2023), row('BYD', 'Dolphin', 2023, 'g2'), row('BYD', 'Seal', 2024)]);
    expect(s.groups.map((g) => [g.name, g.ranges])).toEqual([['BYD Seal', [[2022, 2024]]], ['Toyota Camry', [[2020, 2020]]], ['BYD Dolphin', [[2023, 2023]]]]); expect(s.models).toBe(3); expect(s.vehicles).toBe(5);
  });
  it('the same car entered twice (another engine) is one vehicle', () => { const s = summarizeFitment([row('BYD', 'Seal', 2022), { ...row('BYD', 'Seal', 2022), engineId: 'e2' }]); expect(s.vehicles).toBe(1); expect(s.groups[0].ranges).toEqual([[2022, 2022]]); });
  it('rows whose model cannot be told still count as vehicles but are in no group; nothing at all is empty', () => {
    const s = summarizeFitment([row('BYD', 'Seal', 2022), { label: '???', year: 2020, generationId: 'x' }]); expect(s.groups).toHaveLength(1); expect(s.vehicles).toBe(2); expect(summarizeFitment([])).toEqual({ groups: [], models: 0, vehicles: 0 }); expect(summarizeFitment(undefined).models).toBe(0);
  });
});
