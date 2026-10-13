import { describe, it, expect } from 'vitest';
import { generationOptionLabel } from './vehicleLabels';

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
