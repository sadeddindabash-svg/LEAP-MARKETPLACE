// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The hub's shipment queue reads itself again every 5 seconds (it used to be every 20 seconds). The queue's own loader is already quiet (a failed background load keeps the queue on screen). Reads the source text.
const source = readFileSync(join(__dirname, 'App.jsx'), 'utf8');
describe('the hub queue refresh', () => {
  it('CRITICAL: the queue is read again every 5 seconds (not 20)', () => {
    expect(source).toContain('const interval = setInterval(() => load(false), 5000);');
    expect(source).not.toContain('setInterval(() => load(false), 20000)');
  });
  it('the background load is quiet: it never blanks the queue on an error', () => {
    expect(source).toContain('if (showSpinner) { setErrorMessage(err.message); setLoadState("error"); }');
    expect(source).toContain('load(true);\n    const interval');
  });
  it('it stops when the screen is left', () => { expect(source).toContain('return () => clearInterval(interval);'); });
});
