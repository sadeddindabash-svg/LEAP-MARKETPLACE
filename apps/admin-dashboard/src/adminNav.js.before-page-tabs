// How the admin sidebar groups pages. PURE logic, no React, so it is tested without a browser (adminNav.test.js).
//
// A "page" is what already existed: it has an id ("payouts", "reviews", ...) that is ALSO its permission (admin.allowedPages), what the notification bell,
// the global search and the "Message supplier(s)" links navigate to, and what the shell keeps as its current page. NOTHING about that changes. A GROUP only
// changes the SIDEBAR (one entry instead of several) and adds a row of sub-tabs above the page; the page's own screen is exactly what it was.

export const NAV_GROUPS = [
  { id: 'group:suppliers', label: 'Suppliers', children: ['suppliers', 'supplierMessages'] },
  { id: 'group:products', label: 'Products', children: ['moderation', 'allProducts'] },
  { id: 'group:support', label: 'Support', children: ['tickets', 'reviews', 'promoCodes'] },
  { id: 'group:financial', label: 'Financial', children: ['paymentMethods', 'paymentProviders', 'payouts', 'pricing'] },
];

// The text on a sub-tab (the sidebar used to say "Support" for the tickets page; inside the Support group that page is "Tickets").
export const TAB_LABELS = {
  suppliers: 'Suppliers', supplierMessages: 'Supplier Messages',
  moderation: 'Moderation', allProducts: 'All Products',
  tickets: 'Tickets', reviews: 'Reviews', promoCodes: 'Promo Codes',
  paymentMethods: 'Payment Methods', paymentProviders: 'Payment Providers', payouts: 'Payouts', pricing: 'Pricing',
};

/** The group a page belongs to, or null (Overview, Orders, Returns, Hubs, Settings ... stand alone). */
export function groupOfPage(pageId, groups = NAV_GROUPS) {
  return groups.find((g) => g.children.includes(pageId)) || null;
}

/** The pages of a group this admin may open, in the group's order. */
export function accessibleChildren(group, hasAccess) {
  return group.children.filter((id) => hasAccess(id));
}

/**
 * What the sidebar shows, in order: standalone pages (when allowed) and groups (when the admin may open at least one page in them).
 * A group sits where its FIRST member used to be in the old flat list, so everything else keeps its place.
 * `nav` is the flat list of pages ({ id, label, icon }); `hasAccess(pageId)` says whether the admin may open that page.
 */
export function sidebarEntries(nav, hasAccess, groups = NAV_GROUPS) {
  const entries = [];
  const placed = new Set();
  for (const page of nav) {
    const group = groupOfPage(page.id, groups);
    if (!group) { if (hasAccess(page.id)) entries.push({ type: 'page', page }); continue; }
    if (placed.has(group.id)) continue;                       // a later member of a group already placed: it lives inside that group
    placed.add(group.id);
    if (accessibleChildren(group, hasAccess).length > 0) entries.push({ type: 'group', group });
  }
  return entries;
}

/** The page to open when the group is clicked in the sidebar: the tab the admin was last on in this group, if still allowed, else the first allowed one. */
export function landingPage(group, hasAccess, lastVisited) {
  const allowed = accessibleChildren(group, hasAccess);
  return allowed.includes(lastVisited) ? lastVisited : allowed[0] || null;
}
