// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const rules = require('../../../services/api/scripts/testDataRules.js');

describe('how the cleanup tool recognises test leftovers', () => {
  it('CRITICAL: names the automated tests really create are recognised (timestamps, "Test", "E2E", 测试, the helper\'s padding)', () => {
    const testNames = [
      'SortTestNewer1791364804380', 'UniqueSearchablePart1791364802120', 'SearchTestPart1791364803424.7583', 'BrakeOnly1791368183344', 'FilterOnly1791365651107',
      'Burst1791400000000123-4', 'DupGuard1791400000000', 'Price Drop Test compatible replacement part', 'Pricing Engine Test Product', 'OEM Search Test English',
      'Front Brake Disc, Vented 300mm (Buyer Catalog Test)', 'Valid Item compatible replacement part', 'Bulk A compatible replacement part', 'E2E Brand 1791365435977',
      'AuditBrandTest1791130764626', 'Protection Test Brand 1791368291793', 'Dup Test Brand 1791365435883', 'Year Test Brand 1791365436102', 'Test Category With Parts',
    ];
    for (const name of testNames) expect(rules.looksLikeTest(name), name).toBe(true);
    for (const zh of ['批量测试产品A测试产品名称填充', '搜索测试 1791368182850', '价格下降测试', '真实端到端测试 17913822']) expect(rules.looksLikeTest(zh), zh).toBe(true);
  });

  it('CRITICAL: things a person would really type are NEVER recognised, including a hand-typed gibberish product name and part numbers', () => {
    const realNames = [
      'RIDEX Front Brake Disc, Vented 300mm', 'RIDEX Front Brake Disc, Vented 300mm bvgftgfvbgv bvgfbv', 'Brake Pads (Front)', 'Front Brake Disc', 'Sensor (O2 / MAF / etc.)',
      'Bosch Spark Plug FR7DC+', 'Genuine caliper bracket', 'BMW', 'Toyota', 'Mercedes-Benz', 'Changan', 'Guangzhou Inspection Hub', 'Ningbo Filtration Ltd.',
      'OEM 04465-0K240 front pads', 'Alternator 12V 120A', 'Contest winner bracket', 'Latest model rotor',
    ];
    for (const name of realNames) expect(rules.looksLikeTest(name), name).toBe(false);
    for (const zh of ['我的刹车盘', '前刹车盘', '火花塞']) expect(rules.looksLikeTest(zh), zh).toBe(false);
  });

  it('the seed products (p1, p2, p3...) are never test products, whatever they are called; other ids are judged by their names', () => {
    expect(rules.isTestProduct({ id: 'p1', name: 'RIDEX Front Brake Disc Test 1791368182850' })).toBe(false);
    expect(rules.isTestProduct({ id: 'p9', name: 'Anything test' })).toBe(false);
    expect(rules.isTestProduct({ id: 'p_1791365650764_0', name: 'UniqueSearchablePart1791365650764 (English)', name_zh: '搜索测试 1791365650764' })).toBe(true);
    expect(rules.isTestProduct({ id: 'p_1791365650999_1', name: 'Genuine caliper bracket', name_zh: '卡钳支架' })).toBe(false);
    expect(rules.isTestProduct({ id: 'p_1790000000001_0', name: 'RIDEX Front Brake Disc, Vented 300mm bvgftgfvbgv bvgfbv', name_zh: '我的刹车盘' })).toBe(false);
  });

  it('CRITICAL: only an @example.com address counts as a test account (the tests sign up with those); a real-looking address, or none at all, never does', () => {
    for (const address of ['partial.1791398997@example.com', 'MIXED.Case@Example.COM', 'x@example.org', ' guest.1@example.net ']) expect(rules.isTestAddress(address), address).toBe(true);
    for (const address of ['mec_dabash@yahoo.com', 'real.person@gmail.com', 'someone@example.com.au', 'not-example.com', 'a@notexample.com', '', null, undefined]) expect(rules.isTestAddress(address), String(address)).toBe(false);
  });

  it('CRITICAL: only an admin that clearly looks like a test account is a "test admin": never the owner, never a real colleague (even one with "test" in their name)', () => {
    for (const email of ['perm-test-1791365435977.0095@leap.dev', 'Perm-Test-1791365435977.1@leap.dev', 'addr-limited-1791346251641-ecw23@example.com', 'x.1791365435977@gmail.com', 'admin.case.5@example.com']) {
      expect(rules.isTestAdmin({ email, is_owner: false }), email).toBe(true);
    }
    for (const email of ['sara.manager@gmail.com', 'ahmad@leapautoparts.com', 'test.lead@company.com', 'contest@company.com', 'admin@leap.dev', '']) {
      expect(rules.isTestAdmin({ email, is_owner: false }), email).toBe(false);
    }
    expect(rules.isTestAdmin({ email: 'perm-test-1791365435977@leap.dev', is_owner: true })).toBe(false); // the owner is never one, whatever it is called
  });

  it('categories, parts, brands and hubs: test ones yes, the real ones no (the seed hubs are protected by id as well)', () => {
    expect(rules.isTestCategory({ id: 'test_cat_parts_1791130799700', name_en: 'Test Category With Parts' })).toBe(true);
    for (const id of ['brake', 'engine', 'electrical', 'filters', 'suspension', 'lighting']) expect(rules.isTestCategory({ id, name_en: id })).toBe(false);
    expect(rules.isTestPart('SortTestOlder1791365406548')).toBe(true);
    for (const part of ['Brake Caliper', 'Brake Pads (Front)', 'Front Brake Disc', 'Timing Chain', 'Wiring Harness']) expect(rules.isTestPart(part), part).toBe(false);
    for (const brand of ['E2E Brand 1791365435977', 'AuditBrandTest1791130764626']) expect(rules.isTestVehicleBrand(brand), brand).toBe(true);
    for (const brand of ['BMW', 'Toyota', 'Honda', 'Geely', 'Haval', 'Changan']) expect(rules.isTestVehicleBrand(brand), brand).toBe(false);
    expect(rules.isTestHub({ id: 'hub_guangzhou', name: 'Guangzhou Inspection Hub' })).toBe(false);
    expect(rules.isTestHub({ id: 'hub_guangzhou', name: 'Test 1791365435977' })).toBe(false);   // a seed hub is protected even if renamed
    expect(rules.isTestHub({ id: 'hub_1791365435977', name: 'Perf Test Hub 1791365435977' })).toBe(true);
  });
});
