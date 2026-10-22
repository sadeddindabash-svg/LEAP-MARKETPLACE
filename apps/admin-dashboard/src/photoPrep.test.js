import { describe, it, expect } from 'vitest';
import { codeFromFileName, classify, tally, inBatches, newBatchId, BATCH_SIZE, MIN_SOURCE_PX } from './photoPrep';

// The statuses of the pictures in the preview, before anything is saved.
const sec = (code, hasPhoto = false) => ({ code, hasPhoto });
const part = (code, group, hasPhoto = false) => ({ code, group, hasPhoto });
const coverage = (over = {}) => ({ sections: [sec('BRK'), sec('LGT', true)], parts: [part('BRK-001', 'g1'), part('BRK-002', 'g1'), part('BRK-003', 'g2'), part('LGT-001', 'g3', true)], ...over });
const pic = (file, over = {}) => ({ file, width: 800, height: 800, ...over });
const status = (items, replace = false, cov = coverage()) => classify(items, cov, replace).map((i) => i.status);

describe('a code from a file name (the same rules as the shop)', () => {
  it.each([['BRK.jpg', 'BRK'], ['BRK-001.png', 'BRK-001'], ['brk-001.PNG', 'BRK-001'], ['brk_001.webp', 'BRK-001'], ['C:\\photos\\BRK-001.jpg', 'BRK-001'], ['folder/ENG-012.jpeg', 'ENG-012'], ['  BRK 001 .jpg', 'BRK-001']])('%s is %s', (name, code) => { expect(codeFromFileName(name)).toBe(code); });
  it.each(['holiday photo (1).jpg', '1ABC.jpg', 'BRK-.jpg', 'BRK-12345.jpg', 'TOOLONGCODE-001.jpg', '', '.jpg', 'BRK-001-copy.jpg'])('%s is not a code', (name) => { expect(codeFromFileName(name)).toBeNull(); });
});
describe('the status of each picture', () => {
  it('a camera file name or a plain word has the SHAPE of a code but matches nothing, so it shows as "no such code" (not as a picture to save)', () => { expect(status([pic('IMG_4412.jpg'), pic('brake.jpg')])).toEqual(['unknown_code', 'unknown_code']); });
  it('new (a placeholder), kept (it already has a real picture), unknown code, bad name, not a picture, too small, the same code twice', () => {
    expect(status([pic('BRK.jpg'), pic('LGT.jpg'), pic('ZZZ-999.jpg'), pic('holiday.jpg'), pic('BRK-001.jpg', { error: 'x' }), pic('BRK-003.jpg', { width: 399, height: 900 }), pic('brk.png')])).toEqual(['new', 'kept', 'unknown_code', 'bad_name', 'not_image', 'too_small', 'duplicate']);
  });
  it('a picture exactly at the minimum size is fine; one pixel under is too small', () => { expect(MIN_SOURCE_PX).toBe(400); expect(status([pic('BRK.jpg', { width: 400, height: 400 })])).toEqual(['new']); expect(status([pic('BRK.jpg', { width: 400, height: 399 })])).toEqual(['too_small']); });
  it('the first of two pictures with one code is used, the second is flagged (even in another format)', () => { expect(status([pic('BRK-003.jpg'), pic('brk_003.png')])).toEqual(['new', 'duplicate']); });
  it('a part\'s picture also applies to its other sizes, and says which', () => { const [r] = classify([pic('BRK-002.jpg')], coverage(), false); expect(r.status).toBe('new'); expect(r.applies).toEqual(['BRK-001', 'BRK-002']); });
  it('among sizes that share a picture only the ones without a real picture change; "replace" changes all', () => {
    const cov = coverage({ parts: [part('BRK-001', 'g1', true), part('BRK-002', 'g1'), part('BRK-003', 'g2'), part('LGT-001', 'g3', true)] });
    const [a] = classify([pic('BRK-002.jpg')], cov, false); expect([a.status, a.applies]).toEqual(['new', ['BRK-002']]); const [b] = classify([pic('BRK-002.jpg')], cov, true); expect([b.status, b.applies]).toEqual(['replaces', ['BRK-001', 'BRK-002']]);
  });
  it('"replace" turns kept into replaces, and a section with a picture too', () => { expect(status([pic('LGT.jpg'), pic('LGT-001.jpg')], true)).toEqual(['replaces', 'replaces']); expect(status([pic('LGT.jpg'), pic('LGT-001.jpg')], false)).toEqual(['kept', 'kept']); });
  it('a picture whose code is a part is never matched as a section, and the other way round', () => { expect(status([pic('BRK-003.jpg')], false, coverage({ sections: [sec('BRK-003')] }))).toEqual(['new']); });
  it('the numbers above the preview', () => { expect(tally(classify([pic('BRK.jpg'), pic('LGT.jpg'), pic('ZZZ-999.jpg'), pic('x.jpg'), pic('BRK-003.jpg')], coverage(), false))).toEqual({ willSave: 2, kept: 1, problems: 2 }); });
});
describe('batches', () => {
  it('cuts a list into batches of 20, keeping the order, with nothing lost', () => { const list = Array.from({ length: 45 }, (_, i) => i); const b = inBatches(list); expect(BATCH_SIZE).toBe(20); expect(b.map((x) => x.length)).toEqual([20, 20, 5]); expect(b.flat()).toEqual(list); expect(inBatches([])).toEqual([]); });
  it('an import id is long enough for the shop and different every time', () => { const ids = new Set(Array.from({ length: 50 }, newBatchId)); expect(ids.size).toBe(50); for (const id of ids) expect(id).toMatch(/^imp-[a-z0-9]+-[a-z0-9]+$/); });
});
