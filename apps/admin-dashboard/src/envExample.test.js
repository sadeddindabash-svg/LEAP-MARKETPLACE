// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// services/api/.env.example is what a person copies to set up a server. It drifted twice: settings the server reads were missing from it (so nobody knew to set
// them), and settings nothing reads were listed as if they did something. This keeps it honest in both directions.
const API = path.resolve(import.meta.dirname, '../../../services/api');
const example = fs.readFileSync(path.join(API, '.env.example'), 'utf8');

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  if (e.name === 'node_modules' || e.name === 'backups') return [];
  const full = path.join(dir, e.name);
  return e.isDirectory() ? walk(full) : e.name.endsWith('.js') ? [full] : [];
});
const serverFiles = ['src', 'db', 'scripts'].flatMap((d) => walk(path.join(API, d))).filter((f) => !/\.test\.js$/.test(f));
const readByCode = new Set();
for (const file of serverFiles) for (const m of fs.readFileSync(file, 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) readByCode.add(m[1]);
const active = new Set([...example.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));          // uncommented lines
const mentioned = new Set([...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));  // active or commented-out

describe('services/api/.env.example', () => {
  it('CRITICAL: every setting the server reads is in the file (so nobody has to guess which settings exist)', () => {
    expect([...readByCode].filter((name) => !mentioned.has(name)).sort()).toEqual([]);
    expect(readByCode.size).toBeGreaterThan(25);
  });

  it('CRITICAL: no setting is listed as ACTIVE unless some code reads it (an unused one invites configuring something that does nothing); unused ones must be commented out and say so', () => {
    expect([...active].filter((name) => !readByCode.has(name)).sort()).toEqual([]);
    for (const line of example.split('\n').filter((l) => /^#\s*[A-Z][A-Z0-9_]+=/.test(l) && /NOT read by any code/.test(l))) expect(line).toMatch(/^# [A-Z][A-Z0-9_]+=\s+<- NOT read by any code yet/);
  });

  it('the settings that guard a live installation are documented, and nothing dangerous is switched on by copying the file', () => {
    for (const name of ['JWT_SECRET', 'CREDENTIALS_ENCRYPTION_KEY', 'PUBLIC_API_URL', 'STOREFRONT_URL', 'SUPPLIER_PORTAL_URL', 'SMTP_HOST', 'STRIPE_SECRET_KEY', 'TRACK17_WEBHOOK_SECRET', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'S3_BUCKET']) expect(mentioned.has(name), name).toBe(true);
    expect(active.has('NODE_ENV')).toBe(false);                                         // production mode is switched on deliberately, on the server only
    expect(example).toMatch(/^# NODE_ENV=production/m);
  });
});
