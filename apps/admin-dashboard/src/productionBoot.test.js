// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

// Starts the REAL environment check (services/api/src/config/env.js) in a throwaway process and a clean folder (so no .env of yours can interfere), with exactly
// the settings given, the way the server does at boot.
const ENV_FILE = path.resolve(import.meta.dirname, '../../../services/api/src/config/env.js');
const STRONG = 'a'.repeat(8) + 'Zq3'.repeat(10);                       // 38 characters, not a default
const GOOD = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@h:5432/leap_prod', STRIPE_SECRET_KEY: 'sk_live_x', JWT_SECRET: STRONG, CREDENTIALS_ENCRYPTION_KEY: STRONG };

function boot(settings) {
  const clean = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...settings };           // nothing else from this machine
  const result = spawnSync(process.execPath, ['-e', `const { assertRequiredEnvInProduction } = require(${JSON.stringify(ENV_FILE)}); assertRequiredEnvInProduction(); console.log('BOOT OK');`], { cwd: os.tmpdir(), env: clean, encoding: 'utf8' });
  return { ok: result.status === 0 && result.stdout.includes('BOOT OK'), text: `${result.stdout}${result.stderr}` };
}

describe('the production start-up check (the real env.js)', () => {
  it('CRITICAL: production starts with strong secrets', () => {
    expect(boot(GOOD).ok).toBe(true);
  });

  it('CRITICAL: production REFUSES to start on the public development JWT secret, whether it was left out or typed in (anyone could forge a login for any account)', () => {
    const missing = boot({ ...GOOD, JWT_SECRET: undefined });
    expect(missing.ok).toBe(false);
    expect(missing.text).toMatch(/JWT_SECRET is still set to its insecure development default/);
    const typedIn = boot({ ...GOOD, JWT_SECRET: 'dev-only-insecure-secret-change-me' });
    expect(typedIn.ok).toBe(false);
    expect(typedIn.text).toMatch(/JWT_SECRET is still set to its insecure development default/);
  });

  it('CRITICAL: production REFUSES a JWT secret or credentials key that is too short', () => {
    const shortJwt = boot({ ...GOOD, JWT_SECRET: 'tooshort123' });
    expect(shortJwt.ok).toBe(false);
    expect(shortJwt.text).toMatch(/JWT_SECRET is too short/);
    const shortKey = boot({ ...GOOD, CREDENTIALS_ENCRYPTION_KEY: 'tooshort123' });
    expect(shortKey.ok).toBe(false);
    expect(shortKey.text).toMatch(/CREDENTIALS_ENCRYPTION_KEY is too short/);
    expect(boot({ ...GOOD, JWT_SECRET: 'x'.repeat(32) }).ok).toBe(true);                // exactly 32 is accepted
  });

  it('the existing refusals still hold: the development credentials key, and missing required settings', () => {
    expect(boot({ ...GOOD, CREDENTIALS_ENCRYPTION_KEY: undefined }).text).toMatch(/CREDENTIALS_ENCRYPTION_KEY is still set to its insecure development default/);
    expect(boot({ ...GOOD, DATABASE_URL: undefined }).text).toMatch(/Missing required environment variables in production: databaseUrl/);
    expect(boot({ ...GOOD, STRIPE_SECRET_KEY: undefined }).text).toMatch(/stripeSecretKey/);
  });

  it('CRITICAL: development is NOT affected: the defaults still work on your own computer', () => {
    const dev = boot({ NODE_ENV: 'development' });
    expect(dev.ok).toBe(true);
    expect(boot({}).ok).toBe(true);                                                    // NODE_ENV not set at all = development
  });
});
