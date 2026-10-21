// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { makeSheet, row } from './testSheets.js';

// A 5-seat and a 7-seat "May Day" of the same model, year and engine are two different vehicles. The vehicle import used to call the second one "the same version" (a Problem row).
const require = createRequire(import.meta.url);
const { parseWorkbook } = require('../../../services/api/src/modules/vehicleImport/parser.js');
const { validateRows } = require('../../../services/api/src/modules/vehicleImport/rules.js');
const check = async (rows) => validateRows((await parseWorkbook(await makeSheet(rows))).rows);
const errorsOf = (item) => item.messages.filter((m) => m.level === 'error').map((m) => m.text);
const bj60 = (over) => row({ brand: 'BAIC', model: 'BJ60', year: 2022, version: 'May Day', engine: '2.0T (190 kW)', seats: 5, ...over });

describe('the same version with a different number of seats', () => {
  it('a 5-seat and a 7-seat version (same brand, model, year, name and engine) are BOTH accepted', async () => {
    const items = await check([bj60({ seats: 5 }), bj60({ seats: 7 })]);
    expect(items.map(errorsOf)).toEqual([[], []]);
    expect(items.map((i) => i.data.seats)).toEqual([5, 7]);
  });

  it('the same seats twice is still the same version, and the message names the other row and mentions seats', async () => {
    const items = await check([bj60({ seats: 5 }), bj60({ seats: 7 }), bj60({ seats: 5 })]);
    expect(errorsOf(items[0])).toEqual([]); expect(errorsOf(items[1])).toEqual([]);
    const text = errorsOf(items[2]).join(' ');
    expect(text).toMatch(/same version as row 2/); expect(text).toMatch(/seats/);
  });

  it('a different engine or name is a different version whatever the seats (unchanged)', async () => {
    const items = await check([bj60({ seats: 5 }), bj60({ seats: 5, engine: '1.5T (130 kW)' }), bj60({ seats: 5, version: 'Weekend' })]);
    expect(items.map(errorsOf)).toEqual([[], [], []]);
  });

  it('capitals and extra spaces still do not make a different version when the seats are the same', async () => {
    const items = await check([bj60({ seats: 7 }), bj60({ seats: 7, version: '  may   DAY ' })]);
    expect(errorsOf(items[1]).join(' ')).toMatch(/same version as row 2/);
  });
});
