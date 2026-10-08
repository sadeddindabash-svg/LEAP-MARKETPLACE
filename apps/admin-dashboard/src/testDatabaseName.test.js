// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { deriveTestDatabase, assertSafeToWipe } = require('../../../services/api/db/testDatabase.js');

describe('which database the test runner may wipe', () => {
  it('CRITICAL: the test database is derived from the real one by name, keeping the host, port, user and password', () => {
    const real = 'postgresql://leap_dev:p%40ss%2Fword@localhost:5434/leap_marketplace_dev';
    const test = deriveTestDatabase(real);
    expect(test.name).toBe('leap_marketplace_test');
    expect(test.developmentName).toBe('leap_marketplace_dev');
    const url = new URL(test.url);
    expect(url.hostname).toBe('localhost');
    expect(url.port).toBe('5434');
    expect(url.username).toBe('leap_dev');
    expect(decodeURIComponent(url.password)).toBe('p@ss/word');
    expect(url.pathname).toBe('/leap_marketplace_test');
  });

  it('a database that does not end in "_dev" simply gets "_test" added, and one that already ends in "_test" is used as it is', () => {
    expect(deriveTestDatabase('postgresql://u:p@h:5432/shop').name).toBe('shop_test');
    expect(deriveTestDatabase('postgresql://u:p@h:5432/leap_marketplace').name).toBe('leap_marketplace_test');
    expect(deriveTestDatabase('postgresql://u:p@h:5432/leap_marketplace_test').name).toBe('leap_marketplace_test');
  });

  it('CRITICAL: the derived test database is NEVER the real database, whatever the real one is called', () => {
    for (const name of ['leap_marketplace_dev', 'leap_marketplace', 'prod', 'my_app_DEV', 'x']) {
      const test = deriveTestDatabase(`postgresql://u:p@h:5432/${name}`);
      expect(test.name.toLowerCase()).not.toBe(name.toLowerCase());
      expect(test.name).toMatch(/_test$/i);
    }
  });

  it('CRITICAL: only a database whose name ends in "_test" may be wiped: the real one, the maintenance one and anything else is refused', () => {
    for (const name of ['leap_marketplace_dev', 'leap_marketplace', 'postgres', 'template1', 'test', 'leap_test_data', '', undefined, null]) {
      expect(() => assertSafeToWipe(name), String(name)).toThrow(/Refusing to wipe/);
    }
    for (const name of ['leap_marketplace_test', 'shop_test', 'MY_APP_TEST']) expect(() => assertSafeToWipe(name), name).not.toThrow();
  });

  it('a missing or nameless DATABASE_URL gives a clear message instead of guessing', () => {
    expect(() => deriveTestDatabase('')).toThrow(/DATABASE_URL is not set/);
    expect(() => deriveTestDatabase(undefined)).toThrow(/DATABASE_URL is not set/);
    expect(() => deriveTestDatabase('postgresql://u:p@h:5432/')).toThrow(/no database name/);
  });
});
