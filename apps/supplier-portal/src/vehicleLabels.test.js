import { describe, it, expect } from 'vitest';
import { generationOptionLabel, isSingleYearEntry, yearsWithin, pickerPhoto, vehicleCaption, vehicleSummary } from './vehicleLabels';

describe('how a vehicle year is written in the supplier portal dropdowns', () => {
  it('a year added through Vehicle Data (a one-year entry named by its year) is just the year, not "2021 (2021–2021)"', () => {
    expect(generationOptionLabel({ name: '2021', yearStart: 2021, yearEnd: 2021 }, 'present')).toBe('2021');
    expect(generationOptionLabel({ name: ' 2023 ', yearStart: 2023, yearEnd: 2023 }, 'present')).toBe(' 2023 ');
  });

  it('an older entry keeps its range, and "present" is written in the portal\'s own language', () => {
    expect(generationOptionLabel({ name: 'F20', yearStart: 2015, yearEnd: 2019 }, 'present')).toBe('F20 (2015–2019)');
    expect(generationOptionLabel({ name: 'G20', yearStart: 2019, yearEnd: null }, 'present')).toBe('G20 (2019–present)');
    expect(generationOptionLabel({ name: 'G20', yearStart: 2019, yearEnd: null }, '至今')).toBe('G20 (2019–至今)');
  });

  it('a one-year entry whose name is NOT its year (or whose range is longer) is still shown with its range', () => {
    expect(generationOptionLabel({ name: 'Facelift', yearStart: 2021, yearEnd: 2021 }, 'present')).toBe('Facelift (2021–2021)');
    expect(generationOptionLabel({ name: '2021', yearStart: 2021, yearEnd: 2022 }, 'present')).toBe('2021 (2021–2022)');
  });
});

describe('the vehicle picker\'s rules (pure)', () => {
  it('a one-year entry is recognised by its name being its year; anything else is an older entry', () => {
    expect(isSingleYearEntry({ name: '2021', yearStart: 2021, yearEnd: 2021 })).toBe(true);
    expect(isSingleYearEntry({ name: 'F20', yearStart: 2015, yearEnd: 2019 })).toBe(false);
    expect(isSingleYearEntry({ name: '2021', yearStart: 2021, yearEnd: 2022 })).toBe(false);
    expect(isSingleYearEntry({ name: 'Facelift', yearStart: 2021, yearEnd: 2021 })).toBe(false);
  });

  it('the years a supplier can pick: one for a one-year entry, the whole range for an older one, and an open range runs to next year', () => {
    expect(yearsWithin({ name: '2021', yearStart: 2021, yearEnd: 2021 })).toEqual([2021]);
    expect(yearsWithin({ name: 'F20', yearStart: 2015, yearEnd: 2019 })).toEqual([2015, 2016, 2017, 2018, 2019]);
    expect(yearsWithin({ name: 'G20', yearStart: 2019, yearEnd: null }, 2026)).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]);
  });

  it('CRITICAL: the photo is the YEAR\'s when it has one, else the BRAND\'s, else none; a model never supplies one', () => {
    const brand = { name: 'Geely', photoUrl: '/uploads/brand.png' };
    expect(pickerPhoto({ brand, generation: { photoUrl: '/uploads/year.jpg' } })).toEqual({ url: '/uploads/year.jpg', kind: 'year' });
    expect(pickerPhoto({ brand, generation: { photoUrl: null } })).toEqual({ url: '/uploads/brand.png', kind: 'brand' });
    expect(pickerPhoto({ brand, generation: undefined })).toEqual({ url: '/uploads/brand.png', kind: 'brand' });
    expect(pickerPhoto({ brand: { name: 'Zeekr', photoUrl: null }, generation: { photoUrl: null } })).toEqual({ url: null, kind: null });
    expect(pickerPhoto({ brand: undefined, generation: undefined })).toEqual({ url: null, kind: null });
    expect(pickerPhoto({ brand, model: { photoUrl: '/uploads/model.jpg' } })).toEqual({ url: '/uploads/brand.png', kind: 'brand' });   // an old model photo is ignored
  });

  it('the caption grows with the choices; an older entry adds its name', () => {
    const brand = { name: 'Geely' }, model = { name: 'Coolray' };
    expect(vehicleCaption({ brand })).toBe('Geely');
    expect(vehicleCaption({ brand, model })).toBe('Geely Coolray');
    expect(vehicleCaption({ brand, model, generation: { name: '2021', yearStart: 2021, yearEnd: 2021 }, year: '2021' })).toBe('Geely Coolray, 2021');
    expect(vehicleCaption({ brand: { name: 'BMW' }, model: { name: '1 Series' }, generation: { name: 'F20', yearStart: 2015, yearEnd: 2019 }, year: '2017' })).toBe('BMW 1 Series F20, 2017');
    expect(vehicleCaption({ brand: { name: 'BMW' }, model: { name: '1 Series' }, generation: { name: 'F20', yearStart: 2015, yearEnd: 2019 } })).toBe('BMW 1 Series F20');
  });

  it('a buyer\'s requested vehicle on one line leaves the generation out when it is just the year', () => {
    expect(vehicleSummary({ brand: 'Geely', model: 'Coolray', generation: '2021', year: 2021 })).toBe('Geely Coolray · 2021');
    expect(vehicleSummary({ brand: 'BMW', model: '1 Series', generation: 'F20', year: 2017 })).toBe('BMW 1 Series (F20) · 2017');
    expect(vehicleSummary({ brand: 'BMW', model: '1 Series', generation: null, year: 2017 })).toBe('BMW 1 Series · 2017');
  });
});
