// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NAV_GROUPS, TAB_LABELS, groupOfPage, accessibleChildren, sidebarEntries, landingPage } from './adminNav.js';

// The real list of pages, read from the app itself (id and label of every entry of NAV in App.jsx), so these tests cannot drift from it.
const appSource = fs.readFileSync(path.resolve(import.meta.dirname, 'App.jsx'), 'utf8');
const navBlock = appSource.slice(appSource.indexOf('const NAV = ['), appSource.indexOf('];', appSource.indexOf('const NAV = [')));
const NAV = [...navBlock.matchAll(/\{ id: "(\w+)", label: "([^"]+)"/g)].map((m) => ({ id: m[1], label: m[2] }));
const allowing = (ids) => (id) => ids === 'all' || ids.includes(id);
const labels = (entries) => entries.map((e) => (e.type === 'group' ? e.group.label : e.page.label));

describe('the admin sidebar groups (pure logic)', () => {
  it('CRITICAL: the four groups hold exactly the pages that were agreed, in the agreed order', () => {
    expect(NAV_GROUPS.map((g) => [g.label, g.children])).toEqual([
      ['Suppliers', ['suppliers', 'supplierMessages']],
      ['Products', ['moderation', 'allProducts']],
      ['Support', ['tickets', 'reviews', 'promoCodes']],
      ['Financial', ['paymentMethods', 'paymentProviders', 'payouts', 'pricing']],
    ]);
  });

  it('CRITICAL: no page is lost or duplicated: every page of the app is either on its own in the sidebar or inside EXACTLY ONE group, and every group member is a real page', () => {
    const navIds = NAV.map((n) => n.id);
    expect(navIds.length).toBeGreaterThan(15);
    const members = NAV_GROUPS.flatMap((g) => g.children);
    expect(new Set(members).size).toBe(members.length);                                   // nobody is in two groups
    for (const id of members) expect(navIds, `${id} is a real page`).toContain(id);
    for (const id of members) expect(Object.keys(TAB_LABELS), `${id} has a tab label`).toContain(id);
    const reachable = new Set(sidebarEntries(NAV, allowing('all')).flatMap((e) => (e.type === 'group' ? e.group.children : [e.page.id])));
    for (const id of navIds) expect(reachable.has(id), `${id} can still be reached`).toBe(true);
  });

  it('CRITICAL: for the owner the sidebar is the old list with each group at the place of its first member', () => {
    expect(labels(sidebarEntries(NAV, allowing('all')))).toEqual(['Overview', 'Orders', 'Suppliers', 'Products', 'Returns', 'Vehicle Data', 'Delivery Rules', 'Categories', 'Support', 'Hubs', 'Financial', 'Flagged Shipments', 'Settings']);
  });

  it('CRITICAL: a group is shown when the admin may open AT LEAST ONE of its pages, and only those pages count', () => {
    expect(labels(sidebarEntries(NAV, allowing(['payouts'])))).toEqual(['Financial']);
    expect(labels(sidebarEntries(NAV, allowing(['reviews', 'orders', 'hubs'])))).toEqual(['Orders', 'Support', 'Hubs']);
    expect(labels(sidebarEntries(NAV, allowing([])))).toEqual([]);
    expect(labels(sidebarEntries(NAV, allowing(['supplierMessages'])))).toEqual(['Suppliers']);   // even if the group's FIRST page is not allowed
    const financial = NAV_GROUPS.find((g) => g.label === 'Financial');
    expect(accessibleChildren(financial, allowing(['pricing', 'paymentMethods']))).toEqual(['paymentMethods', 'pricing']);   // in the group's order, not the order of the permission list
  });

  it('a page knows its group, and standalone pages have none', () => {
    expect(groupOfPage('payouts').label).toBe('Financial');
    expect(groupOfPage('tickets').label).toBe('Support');
    for (const id of ['overview', 'orders', 'returns', 'hubs', 'flagged', 'settings', 'categories']) expect(groupOfPage(id), id).toBeNull();
  });

  it('clicking a group opens the tab you were last on if you may still open it, otherwise the first allowed tab', () => {
    const financial = NAV_GROUPS.find((g) => g.label === 'Financial');
    expect(landingPage(financial, allowing('all'), undefined)).toBe('paymentMethods');
    expect(landingPage(financial, allowing('all'), 'pricing')).toBe('pricing');
    expect(landingPage(financial, allowing(['payouts', 'pricing']), 'paymentProviders')).toBe('payouts');   // the remembered tab is no longer allowed
    expect(landingPage(financial, allowing([]), 'pricing')).toBeNull();
  });
});
