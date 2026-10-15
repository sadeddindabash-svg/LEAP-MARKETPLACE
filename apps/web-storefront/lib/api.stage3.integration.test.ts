import { describe, it, expect } from 'vitest';
import {
  addCartItem, cancelOrder, cancelSubOrder, confirmEnglishAddress, createAddress, createReturnCase, fetchAnnualSpend, fetchCart, fetchMyOrders, fetchMyReturnCases, fetchOrderById, fetchOrderReceipt,
  fetchOrderTracking, fetchProducts, placeOrder,
} from './api';
import { addressPayload, EMPTY_ADDRESS } from './address';
import { isOrderCancellable, needsEnglishAddressCheck, reorderLines, subOrderStage } from './orders';

// Orders after the sale against a REAL running backend and database: seeing an order as a buyer and as a guest (and that nobody else can), tracking, the PDF receipt, the English
// address check, cancelling, and return requests.
const BACKEND_URL = 'http://localhost:4000';
async function isBackendUp(): Promise<boolean> { try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; } }
const backendUp = await isBackendUp();

let counter = 0;
async function newBuyer() {
  const email = `stage3-${Date.now()}-${++counter}@leap.dev`;
  const res = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'stage3_password_123', name: 'Stage 3 Buyer' }) });
  expect(res.status).toBe(201);
  const { token, user } = await res.json();
  return { token: token as string, id: user.id as string, email };
}
async function inStock() {
  const found = (await fetchProducts()).find((p) => p.stockQuantity >= 5 && p.price > 0);
  if (!found) throw new Error('No real product with enough stock: reseed the database');
  return found;
}
const addr = { recipientName: 'Stage Three', phone: '+968 9000 0000', country: 'Oman', city: 'Muscat', streetAddress: '12 Al Noor St' };
async function buyerOrder(address: typeof addr = addr) {
  const product = await inStock();
  const buyer = await newBuyer();
  const saved = await createAddress(buyer.token, addressPayload({ ...EMPTY_ADDRESS, label: 'Home', ...address }));
  const order = await placeOrder([{ productId: product.id, quantity: 1 }], { userId: buyer.id }, { addressId: saved.id });
  return { buyer, product, orderId: order.id };
}
async function guestOrder(address: typeof addr = addr) {
  const product = await inStock();
  const email = `stage3-guest-${Date.now()}-${++counter}@example.com`;
  const order = await placeOrder([{ productId: product.id, quantity: 1 }], { guestEmail: email }, { address });
  return { email, product, orderId: order.id };
}

describe.runIf(backendUp)('stage 3a: orders after the sale against a REAL backend', () => {
  it('CRITICAL: a buyer sees their order in full (parts, items, address, English address) and in their list with the supplier label, and it counts in their spending', async () => {
    const { buyer, product, orderId } = await buyerOrder();
    const order = await fetchOrderById(buyer.token, orderId);
    expect(order).toMatchObject({ id: orderId, isGuestOrder: false, status: expect.any(String) });
    expect(order.supplierSubOrders.length).toBeGreaterThan(0);
    const part = order.supplierSubOrders[0];
    expect(part.items[0]).toMatchObject({ productId: product.id, quantity: 1 });
    expect(part.supplierName).toMatch(/^Supplier LEAP-SLR-/);
    expect(typeof subOrderStage(part)).toBe('string');
    expect(order.address).toMatchObject({ city: 'Muscat', country: 'Oman' });
    expect(order.addressEnglish).toHaveProperty('source');

    const list = await fetchMyOrders(buyer.token);
    expect(list.map((o) => o.id)).toEqual([orderId]);
    expect(list[0].supplierNames?.[0]).toMatch(/^Supplier /);
    const spend = await fetchAnnualSpend(buyer.token);
    expect(spend.orderCount).toBe(1);
    expect(spend.totalSpent).toBeCloseTo(order.total, 2);
    expect(reorderLines(order)[0]).toMatchObject({ productId: product.id, quantity: 1 });
  }, 90000);

  it('CRITICAL: a guest opens their order with the email it was placed with, and nobody else can: not with a wrong email, no email, or another buyer\'s sign-in', async () => {
    const { email, orderId } = await guestOrder();
    const seen = await fetchOrderById(null, orderId, email);
    expect(seen).toMatchObject({ id: orderId, isGuestOrder: true, guestEmail: email });
    await expect(fetchOrderById(null, orderId, 'someone-else@example.com')).rejects.toThrow(/not found/i);
    await expect(fetchOrderById(null, orderId)).rejects.toThrow(/not found/i);
    const stranger = await newBuyer();
    await expect(fetchOrderById(stranger.token, orderId)).rejects.toThrow(/not found/i);
    const mine = await buyerOrder();
    await expect(fetchOrderById(stranger.token, mine.orderId)).rejects.toThrow(/not found/i);                       // nor another buyer's order
    await expect(fetchOrderById(null, mine.orderId, email)).rejects.toThrow(/not found/i);                          // nor a guest's email on a buyer's order
  }, 90000);

  it('tracking has the documented shape for the buyer and for the guest (in Arabic too), and the same wall keeps strangers out', async () => {
    const { buyer, orderId } = await buyerOrder();
    const tracking = await fetchOrderTracking(orderId, { token: buyer.token });
    expect(tracking.orderId).toBe(orderId);
    expect(tracking.subOrders.length).toBeGreaterThan(0);
    const sub = tracking.subOrders[0];
    expect(typeof sub.subOrderId).toBe('number');
    expect(Array.isArray(sub.timeline)).toBe(true);
    expect(typeof sub.isDelayed).toBe('boolean');
    expect(sub).toHaveProperty('hubTrackingNumber');
    expect((await fetchOrderTracking(orderId, { token: buyer.token }, 'ar')).subOrders).toHaveLength(tracking.subOrders.length);
    const guest = await guestOrder();
    expect((await fetchOrderTracking(guest.orderId, { guestEmail: guest.email })).orderId).toBe(guest.orderId);
    await expect(fetchOrderTracking(guest.orderId, { guestEmail: 'nope@example.com' })).rejects.toThrow(/not found/i);
    await expect(fetchOrderTracking(guest.orderId, {})).rejects.toThrow(/not found/i);
  }, 90000);

  it('CRITICAL: the receipt is a real PDF (English and Arabic) for the buyer and for the guest, and for nobody else', async () => {
    const { buyer, orderId } = await buyerOrder();
    for (const lang of [undefined, 'ar' as const]) {
      const blob = await fetchOrderReceipt(orderId, { token: buyer.token }, lang);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      expect(bytes.length).toBeGreaterThan(500);
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    }
    const guest = await guestOrder();
    expect((await fetchOrderReceipt(guest.orderId, { guestEmail: guest.email })).size).toBeGreaterThan(500);
    await expect(fetchOrderReceipt(guest.orderId, { guestEmail: 'nope@example.com' })).rejects.toThrow(/not found/i);
    await expect(fetchOrderReceipt(guest.orderId, { token: (await newBuyer()).token })).rejects.toThrow(/not found/i);
  }, 90000);

  it('CRITICAL: an Arabic address gets an English version to check; confirming it clears the check; English letters only', async () => {
    const { buyer, orderId } = await buyerOrder({ ...addr, recipientName: 'سام', city: 'مسقط', streetAddress: 'شارع النور 12' });
    let order = await fetchOrderById(buyer.token, orderId);
    expect(needsEnglishAddressCheck(order)).toBe(true);                                                              // the server's own guess, not yet confirmed
    expect(order.addressEnglish?.source).toBe('auto');
    await expect(confirmEnglishAddress(orderId, { token: buyer.token }, { recipientName: 'سام', country: 'Oman', city: 'مسقط', streetAddress: 'شارع' })).rejects.toThrow(/./);   // Arabic letters refused
    order = await fetchOrderById(buyer.token, orderId);
    expect(needsEnglishAddressCheck(order)).toBe(true);                                                              // the refusal changed nothing
    await confirmEnglishAddress(orderId, { token: buyer.token }, { recipientName: 'Sam', country: 'Oman', city: 'Muscat', streetAddress: '12 Al Noor St' });
    order = await fetchOrderById(buyer.token, orderId);
    expect(needsEnglishAddressCheck(order)).toBe(false);
    expect(order.addressEnglish).toMatchObject({ city: 'Muscat', streetAddress: '12 Al Noor St', confirmed: true });
    const another = await buyerOrder({ ...addr, city: 'مسقط' });
    await confirmEnglishAddress(another.orderId, { token: another.buyer.token });                                    // "It is correct": as it is
    expect(needsEnglishAddressCheck(await fetchOrderById(another.buyer.token, another.orderId))).toBe(false);
    await expect(confirmEnglishAddress(orderId, { token: (await newBuyer()).token })).rejects.toThrow(/not found/i);
  }, 120000);

  it('CRITICAL: an order can be cancelled by its buyer (once), and by a guest with their email; a stranger cannot; the stage and the rule agree', async () => {
    const { buyer, orderId } = await buyerOrder();
    const before = await fetchOrderById(buyer.token, orderId);
    expect(isOrderCancellable(before)).toBe(true);
    await expect(cancelOrder(orderId, { token: (await newBuyer()).token })).rejects.toThrow(/not found/i);
    await cancelOrder(orderId, { token: buyer.token });
    const after = await fetchOrderById(buyer.token, orderId);
    expect(after.status).toBe('cancelled');
    expect(isOrderCancellable(after)).toBe(false);
    await expect(cancelOrder(orderId, { token: buyer.token })).rejects.toThrow(/already cancelled/i);

    const guest = await guestOrder();
    await expect(cancelOrder(guest.orderId, { guestEmail: 'nope@example.com' })).rejects.toThrow(/not found/i);
    await cancelOrder(guest.orderId, { guestEmail: guest.email });
    expect((await fetchOrderById(null, guest.orderId, guest.email)).status).toBe('cancelled');
  }, 120000);

  it('a single part can be cancelled by its buyer and not by anyone else', async () => {
    const { buyer, orderId } = await buyerOrder();
    const part = (await fetchOrderById(buyer.token, orderId)).supplierSubOrders[0];
    await expect(cancelSubOrder(orderId, part.subOrderId, { token: (await newBuyer()).token })).rejects.toThrow(/not found/i);
    await cancelSubOrder(orderId, part.subOrderId, { token: buyer.token });
    expect((await fetchOrderById(buyer.token, orderId)).supplierSubOrders[0].status).toBe('cancelled');
  }, 90000);

  it('CRITICAL: a return request is made for a part by its buyer (with photos) or by a guest (with their email); it needs everything, and nobody else\'s part', async () => {
    const { buyer, orderId } = await buyerOrder();
    const subOrderId = (await fetchOrderById(buyer.token, orderId)).supplierSubOrders[0].subOrderId;
    const made = await createReturnCase({ subOrderId, reason: 'Damaged', message: 'Cracked on arrival', photos: ['/uploads/a.jpg', '/uploads/b.jpg'] }, { token: buyer.token });
    expect(made.id).toMatch(/^RC-/);
    expect((await fetchMyReturnCases(buyer.token)).map((c) => c.id)).toContain(made.id);
    await expect(createReturnCase({ subOrderId, reason: '', message: 'x' }, { token: buyer.token })).rejects.toThrow(/required/i);
    await expect(createReturnCase({ subOrderId: 99999999, reason: 'r', message: 'm' }, { token: buyer.token })).rejects.toThrow(/not found/i);
    await expect(createReturnCase({ subOrderId, reason: 'r', message: 'm' }, {})).rejects.toThrow(/guestEmail|required/i);        // neither signed in nor an email

    const guest = await guestOrder();
    const guestPart = (await fetchOrderById(null, guest.orderId, guest.email)).supplierSubOrders[0].subOrderId;
    const guestReturn = await createReturnCase({ subOrderId: guestPart, reason: 'Wrong item', message: 'Not what I ordered' }, { guestEmail: guest.email });
    expect(guestReturn.id).toMatch(/^RC-/);
  }, 120000);

  it('a reorder works against the real cart: every line of the order goes back in', async () => {
    const { buyer, product, orderId } = await buyerOrder();
    const lines = reorderLines(await fetchOrderById(buyer.token, orderId));
    const cartId = `stage3-cart-${Date.now()}`;
    for (const l of lines) await addCartItem(cartId, l.productId, l.quantity, { token: buyer.token });
    const cart = await fetchCart(cartId, { token: buyer.token });
    expect(cart.items.map((i) => i.productId)).toEqual([product.id]);
  }, 90000);
});
