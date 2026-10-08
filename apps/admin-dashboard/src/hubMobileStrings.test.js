// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// The hub phone app (Flutter) cannot be compiled where these tests run, so this checks what most often goes wrong when screens are added: the wording table
// (apps/hub-mobile/lib/core/hub_strings.dart) against the CODE that uses it, in BOTH languages.
const LIB = path.resolve(import.meta.dirname, '../../hub-mobile/lib');
const source = fs.readFileSync(path.join(LIB, 'core/hub_strings.dart'), 'utf8');
const CHINESE = /[\u4e00-\u9fff]/;

// The text of one `kind(` ... `)` constructor call inside the language block, found by matching its brackets.
function callBody(text, startIndex) {
  let depth = 0, inString = null;
  for (let i = startIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) { if (ch === '\\') i += 1; else if (ch === inString) inString = null; continue; }
    if (ch === "'" || ch === '"') { inString = ch; continue; }
    if (ch === '(') depth += 1;
    if (ch === ')') { depth -= 1; if (depth === 0) return text.slice(startIndex, i + 1); }
  }
  throw new Error('unbalanced brackets');
}
const languageBlock = (code) => { const at = source.indexOf(`'${code}': HubText(`); return callBody(source, source.indexOf('(', at)); };
const blocks = { zh: languageBlock('zh'), en: languageBlock('en') };
const callIn = (block, name) => callBody(block, block.indexOf('(', block.indexOf(`${name}:`)));
// A `name: { ... }` map literal, found by matching its curly brackets.
function mapIn(block, name) {
  const start = block.indexOf('{', block.indexOf(`${name}:`));
  let depth = 0, inString = null;
  for (let i = start; i < block.length; i += 1) {
    const ch = block[i];
    if (inString) { if (ch === '\\') i += 1; else if (ch === inString) inString = null; continue; }
    if (ch === "'" || ch === '"') { inString = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') { depth -= 1; if (depth === 0) return block.slice(start, i + 1); }
  }
  throw new Error(`unbalanced map ${name}`);
}

// The named arguments of a call, each with its OWN value text: a value ends at the next comma that is not inside a string or a bracket.
function fieldsOf(body) {
  const fields = new Map();
  let depth = 0, inString = null, name = null, valueStart = 0;
  const close = (end) => { if (name !== null) fields.set(name, body.slice(valueStart, end).trim()); name = null; };
  for (let i = 1; i < body.length - 1; i += 1) {
    const ch = body[i];
    if (inString) { if (ch === '\\') i += 1; else if (ch === inString) inString = null; continue; }
    if (ch === "'" || ch === '"') { inString = ch; continue; }
    if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) depth -= 1;
    else if (depth === 0 && ch === ',') close(i);
    else if (depth === 0 && name === null) {
      const m = body.slice(i).match(/^([a-zA-Z][a-zA-Z0-9]*):\s*/);
      if (m && /[\s,(]/.test(body[i - 1] || ' ')) { name = m[1]; valueStart = i + m[0].length; i += m[0].length - 1; }
    }
  }
  close(body.length - 1);
  return fields;
}
const givenNames = (body) => [...fieldsOf(body).keys()];
const requiredNames = (className) => {
  const at = source.indexOf(`class ${className} {`);
  const ctor = callBody(source, source.indexOf(`const ${className}(`, at) + `const ${className}`.length);
  return [...ctor.matchAll(/required this\.(\w+)/g)].map((m) => m[1]);
};
// every quoted string literal value inside a block (single or double quoted)
const stringValues = (body) => [...body.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1] ?? m[2]);

describe('the hub app wording table', () => {
  it('CRITICAL: both languages give EVERY field the app asks for (a missing one would stop the app compiling), and nothing the app does not know', () => {
    for (const cls of ['DetailText', 'PasswordText', 'LoginText', 'QueueText']) {
      const key = { DetailText: 'detail', PasswordText: 'changePassword', LoginText: 'login', QueueText: 'queue' }[cls];
      const required = requiredNames(cls).sort();
      expect(required.length, cls).toBeGreaterThan(3);
      for (const language of ['zh', 'en']) {
        const given = givenNames(callIn(blocks[language], key)).sort();
        expect(given, `${cls} in ${language}`).toEqual(required);
      }
    }
  });

  it('CRITICAL: the top-level wording (including the scan screen\'s camera error) is complete in both languages', () => {
    const required = requiredNames('HubText').sort();
    for (const language of ['zh', 'en']) expect(givenNames(blocks[language]).sort(), language).toEqual(required);
    for (const name of ['cameraError', 'cameraErrorHint', 'backToList']) {
      for (const language of ['zh', 'en']) {
        const value = stringValues(fieldsOf(blocks[language]).get(name) || '').join(' ');
        expect(value.length, `${name} (${language}) is empty`).toBeGreaterThan(0);
        expect(CHINESE.test(value), `${name} (${language})`).toBe(language === 'zh');
      }
    }
  });

  it('CRITICAL: the Chinese is Chinese and the English is English in everything added for the fault panel, closed flags, replacements and the password screen', () => {
    for (const [cls, key] of [['DetailText', 'detail'], ['PasswordText', 'changePassword']]) {
      const only = cls === 'DetailText'
        ? ['faultTitle', 'faultDesc', 'faultItems', 'returnOption', 'discardOption', 'returnTracking', 'submitReturn', 'submitDiscard', 'returnedBanner', 'discardedBanner', 'waitingOnHub', 'sendTo', 'noReturnAddress', 'errReturnTrackingRequired', 'replacementTag', 'replacementFor', 'replacementHint', 'stage', 'resolvedBanners']
        : requiredNames(cls);
      for (const name of only) {
        for (const language of ['zh', 'en']) {
          const fields = fieldsOf(callIn(blocks[language], key));
          expect(fields.has(name), `${key}.${name} in ${language}`).toBe(true);
          const value = stringValues(fields.get(name)).join(' ');
          expect(value.length, `${key}.${name} (${language}) is empty`).toBeGreaterThan(0);
          if (language === 'zh') expect(CHINESE.test(value), `${key}.${name}: Chinese text has no Chinese characters`).toBe(true);
          else expect(CHINESE.test(value), `${key}.${name}: English text contains Chinese characters`).toBe(false);
        }
      }
    }
  });

  it('CRITICAL: every status the hub server can produce has a label in both languages (the app used to show the raw word for a returned or discarded unit)', () => {
    for (const language of ['zh', 'en']) {
      const steps = mapIn(blocks[language], 'steps');
      for (const status of ['awaiting_receipt', 'received', 'opened', 'inspected', 'packed', 'shipped_to_buyer', 'delivered', 'flagged', 'returned_to_supplier', 'discarded_at_hub', 'closed']) {
        expect(steps, `${status} in ${language}`).toContain(`'${status}': StepText(`);
      }
    }
  });

  it('every resolution the platform can record has a banner, in both languages', () => {
    for (const language of ['zh', 'en']) {
      const banners = callIn(blocks[language], 'detail').split('resolvedBanners:')[1];
      for (const resolution of ['continue_processing', 'return_to_supplier', 'discard', 'replacement_requested', 'fault_closed_manually', 'fault_refund', 'fault_replacement']) {
        expect(banners, `${resolution} in ${language}`).toContain(`'${resolution}':`);
      }
      const stage = callIn(blocks[language], 'detail').split('stage:')[1];
      for (const s of ['reviewing', 'finalising', 'closed']) expect(stage, `stage ${s} in ${language}`).toContain(`'${s}':`);
    }
  });

  it('CRITICAL: every wording field the screens use (t.detail.x, t.changePassword.x, text.changePassword.x) exists', () => {
    const detail = new Set(requiredNames('DetailText'));
    const password = new Set(requiredNames('PasswordText'));
    const used = { detail: new Map(), password: new Map() };
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.dart') ? [path.join(dir, e.name)] : []));
    for (const file of walk(LIB)) {
      const code = fs.readFileSync(file, 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
      for (const m of code.matchAll(/\bt\.detail\.(\w+)/g)) used.detail.set(m[1], path.relative(LIB, file));
      for (const m of code.matchAll(/\b(?:t|text)\.changePassword\.(\w+)/g)) used.password.set(m[1], path.relative(LIB, file));
      if (/\bfinal t = text\.changePassword;/.test(code)) for (const m of code.matchAll(/\bt\.(title|intro|current|newPassword|confirm|submit|saving|tooShort|mismatch|same)\b/g)) used.password.set(m[1], path.relative(LIB, file));
    }
    expect([...used.detail].filter(([k]) => !detail.has(k)).map(([k, f]) => `${k} (${f})`)).toEqual([]);
    expect([...used.password].filter(([k]) => !password.has(k)).map(([k, f]) => `${k} (${f})`)).toEqual([]);
    expect(used.detail.size).toBeGreaterThan(20);
  });
});
