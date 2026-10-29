#!/usr/bin/env node
/**
 * SUPPLIER PORTAL: AUTO REFRESH every 5 seconds, only while the tab is visible (at once when it becomes visible again), quietly (no spinner; an error keeps what is on screen; nothing is redrawn when nothing changed). Needs src/autoRefresh.js from the same package.
 *
 *   node scripts/patch-auto-refresh-supplier.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-auto-refresh-supplier.js --write    applies it (each changed file is saved as <file>.before-auto-refresh-supplier first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/supplier-portal/src/App.jsx", "what": "the supplier portal refreshes itself every 5 seconds: overview, orders, the open order, returns, finance, products, notifications, part requests, messages and the unread badge", "done": "useAutoRefresh(() => fetchMyOverview", "pairs": [["import { LangContext, useLang } from \"./langContext\";", "import { LangContext, useLang } from \"./langContext\";\nimport { useAutoRefresh, setIfChanged, sameData } from \"./autoRefresh\";"], ["  useEffect(() => {\n    fetchMyOverview(getStoredToken())\n      .then((d) => { setData(d); setLoadState(\"ready\"); })\n      .catch((err) => {\n        if (err instanceof SessionExpiredError) return onSessionExpired();\n        setErrorMessage(err.message);\n        setLoadState(\"error\");\n      });\n  }, [onSessionExpired]);", "  useEffect(() => {\n    fetchMyOverview(getStoredToken())\n      .then((d) => { setData(d); setLoadState(\"ready\"); })\n      .catch((err) => {\n        if (err instanceof SessionExpiredError) return onSessionExpired();\n        setErrorMessage(err.message);\n        setLoadState(\"error\");\n      });\n  }, [onSessionExpired]);\n  useAutoRefresh(() => fetchMyOverview(getStoredToken()).then(setIfChanged(setData)), { enabled: loadState === \"ready\" });"], ["  useEffect(() => {\n    fetchMyOrders(getStoredToken())\n      .then((data) => { setOrders(data); setLoadState(\"ready\"); })\n      .catch((err) => {\n        if (err instanceof SessionExpiredError) return onSessionExpired();\n        setErrorMessage(err.message);\n        setLoadState(\"error\");\n      });\n  }, [onSessionExpired]);", "  useEffect(() => {\n    fetchMyOrders(getStoredToken())\n      .then((data) => { setOrders(data); setLoadState(\"ready\"); })\n      .catch((err) => {\n        if (err instanceof SessionExpiredError) return onSessionExpired();\n        setErrorMessage(err.message);\n        setLoadState(\"error\");\n      });\n  }, [onSessionExpired]);\n  useAutoRefresh(() => fetchMyOrders(getStoredToken()).then(setIfChanged(setOrders)), { enabled: loadState === \"ready\" });"], ["  useEffect(() => {\n    fetchMyReturnCases(getStoredToken())\n      .then((data) => { setCases(data); setLoadState(\"ready\"); })\n      .catch((err) => {\n        if (err instanceof SessionExpiredError) return onSessionExpired();\n        setErrorMessage(err.message);\n        setLoadState(\"error\");\n      });\n  }, [onSessionExpired]);", "  useEffect(() => {\n    fetchMyReturnCases(getStoredToken())\n      .then((data) => { setCases(data); setLoadState(\"ready\"); })\n      .catch((err) => {\n        if (err instanceof SessionExpiredError) return onSessionExpired();\n        setErrorMessage(err.message);\n        setLoadState(\"error\");\n      });\n  }, [onSessionExpired]);\n  useAutoRefresh(() => fetchMyReturnCases(getStoredToken()).then(setIfChanged(setCases)), { enabled: loadState === \"ready\" });"], ["  useEffect(() => {\n    fetchMyFinance(getStoredToken())\n      .then(setFinance)\n      .catch((err) => {\n        if (err instanceof SessionExpiredError) return onSessionExpired();\n        setFinanceError(err.message);\n      });\n  }, []); // eslint-disable-line react-hooks/exhaustive-deps", "  useEffect(() => {\n    fetchMyFinance(getStoredToken())\n      .then(setFinance)\n      .catch((err) => {\n        if (err instanceof SessionExpiredError) return onSessionExpired();\n        setFinanceError(err.message);\n      });\n  }, []); // eslint-disable-line react-hooks/exhaustive-deps\n  useAutoRefresh(() => fetchMyFinance(getStoredToken()).then(setIfChanged(setFinance)));"], ["    fetchMyProducts(getStoredToken())\n      .then((data) => { setProducts(data); setLoadState(\"ready\"); })\n      .catch((err) => {\n        if (err instanceof SessionExpiredError) return onSessionExpired();\n        setErrorMessage(err.message);\n        setLoadState(\"error\");\n      });\n  };\n  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps", "    fetchMyProducts(getStoredToken())\n      .then((data) => { setProducts(data); setLoadState(\"ready\"); })\n      .catch((err) => {\n        if (err instanceof SessionExpiredError) return onSessionExpired();\n        setErrorMessage(err.message);\n        setLoadState(\"error\");\n      });\n  };\n  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps\n  useAutoRefresh(() => fetchMyProducts(getStoredToken()).then(setIfChanged(setProducts)), { enabled: loadState === \"ready\" && mode === \"list\" && !editingProduct && !showBulkPriceModal });"], ["    fetchMyNotifications(getStoredToken())\n      .then(setNotifications)\n      .catch((err) => setErrorMessage(err.message));\n  };\n  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps", "    fetchMyNotifications(getStoredToken())\n      .then(setNotifications)\n      .catch((err) => setErrorMessage(err.message));\n  };\n  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps\n  useAutoRefresh(() => fetchMyNotifications(getStoredToken()).then(setIfChanged(setNotifications)));"], ["  useEffect(() => {\n    setLoadState(\"loading\");\n    fetchPartRequestQueue(getStoredToken())\n      .then((q) => { setQueue(q); setLoadState(\"ready\"); })\n      .catch((e) => {\n        if (e instanceof SessionExpiredError) return onSessionExpired();\n        setErrorMessage(e.message);\n        setLoadState(\"error\");\n      });\n  }, [onSessionExpired]);", "  useEffect(() => {\n    setLoadState(\"loading\");\n    fetchPartRequestQueue(getStoredToken())\n      .then((q) => { setQueue(q); setLoadState(\"ready\"); })\n      .catch((e) => {\n        if (e instanceof SessionExpiredError) return onSessionExpired();\n        setErrorMessage(e.message);\n        setLoadState(\"error\");\n      });\n  }, [onSessionExpired]);\n  useAutoRefresh(() => fetchPartRequestQueue(getStoredToken()).then(setIfChanged(setQueue)), { enabled: loadState === \"ready\" });"], ["  useEffect(refreshUnreadCount, []);\n", "  useEffect(refreshUnreadCount, []);\n  useAutoRefresh(refreshUnreadCount);      // the sidebar's unread badge\n  // The order that is open (a copy of its row) follows the supplier's orders: a change made elsewhere (the buyer cancelled it, the hub received it) appears in the open order by itself.\n  useAutoRefresh(async () => {\n    if (!openOrder) return;\n    const list = await fetchMyOrders(getStoredToken());\n    const fresh = Array.isArray(list) ? list.find((o) => o.subOrderId === openOrder.subOrderId) : null;\n    if (fresh) setOpenOrder((current) => (current && current.subOrderId === fresh.subOrderId && !sameData(current, fresh) ? fresh : current));\n  }, { enabled: !!openOrder });\n"], ["const interval = setInterval(() => load(false), 20000);", "const interval = setInterval(() => load(false), 5000);"]]}], "whole": []};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const once = (s, a) => s.split(a).length === 2;

const plan = [];
let problems = 0;
const refuse = (file, why) => { console.log(`REFUSED   ${file}: ${why}`); problems++; };
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  if (s.includes(e.done)) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a, b] of e.pairs) { if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { refuse(e.file, 'its text is not what this patch expects, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.whole) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'auto-refresh-supplier-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'auto-refresh-supplier-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-auto-refresh-supplier`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
