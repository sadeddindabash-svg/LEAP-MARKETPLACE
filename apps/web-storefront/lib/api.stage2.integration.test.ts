import { describe, it, expect, afterEach } from 'vitest';
import { stockedProduct } from './testSupport';
import {
  addCartItem, applyCartPromoCode, createAddress, deleteAddress, fetchCart, fetchMyAddresses, fetchMyOrders, fetchPaymentMethodsForCountry, lockCartPrices, placeOrder, setCartItemQuantity, updateAddress,
} from './api';
import { addressPayload, EMPTY_ADDRESS } from './address';
import { supplierLabel, totals } from './cart';
import { localizeServerMessage, setErrorLanguage } from './serverMessages';

// This stage's calls against a REAL running backend and database: the cart as a signed-in buyer, the price lock, promo codes, payment methods for a country, the address book
// and placing an order (including the duplicate-order protection and "wait and ship together").
const BACKEND_URL = 'http://localhost:4000';
async function isBackendUp(): Promise<boolean> {
  try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; }
}
const backendUp = await isBackendUp();

let counter = 0;
async function newBuyer(): Promise<{ token: string; id: string; email: string }> {
  const email = `stage2-${Date.now()}-${++counter}@leap.dev`;
  const res = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'stage2_password_123', name: 'Stage 2 Buyer' }) });
  expect(res.status).toBe(201);
  const { token, user } = await res.json();
  return { token, id: user.id, email };
}
async function adminToken(): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@leap.dev', password: 'admin_dev_password_123' }) });
  return (await res.json()).token;
}
async function inStock(minQuantity = 5, minPrice = 0) {
  return stockedProduct(minPrice, minQuantity);          // restocks when earlier runs used the stock up (see testSupport.ts)
}
const cartId = () => `stage2-cart-${Date.now()}-${++counter}`;
const oman = (over = {}) => ({ ...EMPTY_ADDRESS, label: 'Home', recipientName: 'Stage Two', phone: '+968 9000 0000', country: 'Oman', city: 'Muscat', streetAddress: '12 Al Noor St', ...over });

afterEach(() => setErrorLanguage('en'));

describe.runIf(backendUp)('stage 2: cart, checkout and address book against a REAL backend', () => {
  it('CRITICAL: the cart carries what the page shows (photo, supplier label, original price, stock, the discount fields) for a visitor and for a signed-in buyer', async () => {
    const product = await inStock();
    const id = cartId();
    const added = await addCartItem(id, product.id, 2);
    expect(added.items).toHaveLength(1);
    const item = added.items[0];
    expect(item).toMatchObject({ productId: product.id, quantity: 2 });
    expect(typeof item.price).toBe('number');
    expect(item).toHaveProperty('originalPrice');
    expect(item).toHaveProperty('imageUrl');
    expect(typeof item.priceChanged).toBe('boolean');
    expect(item.stockQuantity).toBeGreaterThanOrEqual(2);
    expect(item.supplierName).toMatch(/^Supplier LEAP-SLR-/);                                                    // the anonymised label the page re-words in Arabic
    expect(supplierLabel(item.supplierName, 'المورد')).toMatch(/^المورد LEAP-SLR-/);
    for (const key of ['appliedDiscountUsd', 'appliedDiscountSource', 'loyaltyDiscountPercentage', 'loyaltyDiscountUsd', 'promoDiscountUsd', 'lockActive']) expect(added).toHaveProperty(key);
    expect(totals(added).total).toBeCloseTo(item.price * 2, 2);

    const buyer = await newBuyer();                                                                    // the same cart, asked for as a signed-in buyer, is attached to them
    const mine = await fetchCart(id, { token: buyer.token });
    expect(mine.items).toHaveLength(1);
    expect(['none', 'loyalty', 'promo']).toContain(mine.appliedDiscountSource);
    expect(mine.loyaltyDiscountPercentage).toBeGreaterThanOrEqual(0);
  }, 60000);

  it('changing and removing quantities keep the cart in step, and asking for Arabic returns the same lines', async () => {
    const product = await inStock();
    const id = cartId();
    await addCartItem(id, product.id, 1);
    const more = await setCartItemQuantity(id, product.id, 3);
    expect(more.items[0].quantity).toBe(3);
    const ar = await fetchCart(id, { lang: 'ar' });
    expect(ar.items.map((i) => i.productId)).toEqual([product.id]);
  }, 60000);

  it('CRITICAL: locking the prices holds them for a while (and locking again does not extend it)', async () => {
    const product = await inStock();
    const id = cartId();
    const before = await addCartItem(id, product.id, 1);
    expect(before.lockActive).toBe(false);
    const locked = await lockCartPrices(id);
    expect(locked.lockActive).toBe(true);
    expect(typeof locked.lockExpiresAt).toBe('string');
    expect(new Date(locked.lockExpiresAt as string).getTime()).toBeGreaterThan(Date.now());
    const again = await lockCartPrices(id);
    expect(again.lockExpiresAt).toBe(locked.lockExpiresAt);                                             // a lock already running is left as it is
    expect(locked.items[0].price).toBe(before.items[0].price);
  }, 60000);

  it('CRITICAL: a promo code goes on the cart only if the server accepts it: refused with the reason when not valid, applied and removable when valid', async () => {
    const product = await inStock(5, 20);
    const id = cartId();
    await addCartItem(id, product.id, 1);
    await expect(applyCartPromoCode(id, `NOSUCHCODE${Date.now()}`)).rejects.toThrow(/./);
    expect((await fetchCart(id)).appliedPromoCode ?? null).toBeNull();                                 // a refused code leaves no trace

    const code = `STAGE2${Date.now()}`;
    await fetch(`${BACKEND_URL}/promo-codes`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await adminToken()}` }, body: JSON.stringify({ code, type: 'flat', value: 5 }) });
    const withCode = await applyCartPromoCode(id, code);
    expect(withCode.appliedPromoCode).toBe(code);
    expect(withCode.appliedDiscountSource === 'promo' || withCode.appliedDiscountSource === 'loyalty').toBe(true);
    expect(withCode.appliedDiscountUsd).toBeGreaterThan(0);
    const without = await applyCartPromoCode(id, null);
    expect(without.appliedPromoCode ?? null).toBeNull();
  }, 60000);

  it('an error the server words is turned into Arabic on an Arabic page when the mobile app has it in its list, and left English when it has not', async () => {
    const id = cartId();
    setErrorLanguage('ar');
    let message = '';
    await applyCartPromoCode(id, `NOSUCHCODE${Date.now()}`).catch((e: Error) => { message = e.message; });
    setErrorLanguage('en');
    let english = '';
    await applyCartPromoCode(id, `NOSUCHCODE${Date.now()}`).catch((e: Error) => { english = e.message; });
    expect(english.length).toBeGreaterThan(0);
    expect(message).toBe(localizeServerMessage(english));
  }, 60000);

  it('payment methods for a country: a list of methods (by English name or by code), and none for a country that does not exist', async () => {
    const byName = await fetchPaymentMethodsForCountry('Oman');
    const byCode = await fetchPaymentMethodsForCountry('OM');
    expect(byCode.map((m) => m.id)).toEqual(byName.map((m) => m.id));
    for (const m of byName) { expect(typeof m.id).toBe('string'); expect(typeof m.nameEn).toBe('string'); expect(m).toHaveProperty('nameAr'); expect(m).toHaveProperty('photoUrl'); }
    expect(await fetchPaymentMethodsForCountry('Atlantis')).toEqual([]);
  }, 30000);

  it('CRITICAL: the address book: save (in the form the page sends), change the default, edit, delete, and a fourth address is refused with the limit', async () => {
    const { token } = await newBuyer();
    const first = await createAddress(token, addressPayload(oman({ label: 'One' })));
    expect(first).toMatchObject({ label: 'One', country: 'Oman', isDefault: true });                   // the first address becomes the default
    const saudi = await createAddress(token, addressPayload(oman({ label: 'Two', country: 'Saudi Arabia', nationalAddress: 'rrrd2929', postalCode: '12345', state: 'Riyadh' })));
    expect(saudi).toMatchObject({ country: 'Saudi Arabia', nationalAddress: 'RRRD2929', postalCode: '12345', state: 'Riyadh' });
    await createAddress(token, addressPayload(oman({ label: 'Three' })));
    await expect(createAddress(token, addressPayload(oman({ label: 'Four' })))).rejects.toThrow(/up to 3 addresses/);

    await updateAddress(token, saudi.id, { isDefault: true });
    let list = await fetchMyAddresses(token);
    expect(list.filter((a) => a.isDefault).map((a) => a.id)).toEqual([saudi.id]);
    await updateAddress(token, first.id, addressPayload(oman({ label: 'One edited', city: 'Salalah' })));
    list = await fetchMyAddresses(token);
    expect(list.find((a) => a.id === first.id)).toMatchObject({ label: 'One edited', city: 'Salalah' });
    await deleteAddress(token, first.id);
    expect((await fetchMyAddresses(token)).map((a) => a.id)).not.toContain(first.id);
    await createAddress(token, addressPayload(oman({ label: 'Four' })));                                // room again
  }, 60000);

  it('one buyer cannot change or delete another buyer\'s address', async () => {
    const a = await newBuyer(); const b = await newBuyer();
    const mine = await createAddress(a.token, addressPayload(oman()));
    await expect(updateAddress(b.token, mine.id, { city: 'Hacked' })).rejects.toThrow(/not found/i);
    await expect(deleteAddress(b.token, mine.id)).rejects.toThrow(/not found/i);
    expect((await fetchMyAddresses(a.token))[0].city).toBe('Muscat');
  }, 60000);

  it('CRITICAL: placing an order as a GUEST with an address, then as a signed-in buyer with a saved address; both orders exist', async () => {
    const product = await inStock(5);
    const guest = await placeOrder([{ productId: product.id, quantity: 1 }], { guestEmail: `stage2-guest-${Date.now()}@example.com` }, { address: { recipientName: 'Guest', phone: '+968 1', country: 'Oman', city: 'Muscat', streetAddress: '1 Main St' } });
    expect(guest.id).toBeTruthy();
    expect(guest.total).toBeGreaterThan(0);

    const buyer = await newBuyer();
    const addr = await createAddress(buyer.token, addressPayload(oman()));
    const order = await placeOrder([{ productId: product.id, quantity: 1 }], { userId: buyer.id }, { addressId: addr.id }, undefined, { waitForAllShipments: true });
    expect(order.id).toBeTruthy();
    expect((await fetchMyOrders(buyer.token)).map((o) => o.id)).toContain(order.id);
  }, 60000);

  it('CRITICAL: the same order sent twice with the same key is ONE order (a double click, or a retry after a lost answer)', async () => {
    const product = await inStock(5);
    const buyer = await newBuyer();
    const addr = await createAddress(buyer.token, addressPayload(oman()));
    const key = `stage2-key-${Date.now()}`;
    const send = () => placeOrder([{ productId: product.id, quantity: 1 }], { userId: buyer.id }, { addressId: addr.id }, undefined, { idempotencyKey: key, waitForAllShipments: false });
    const [first, second] = [await send(), await send()];
    expect(second.id).toBe(first.id);
    expect((await fetchMyOrders(buyer.token)).filter((o) => o.id === first.id)).toHaveLength(1);
    expect((await fetchMyOrders(buyer.token))).toHaveLength(1);                                         // not two orders
    const other = await placeOrder([{ productId: product.id, quantity: 1 }], { userId: buyer.id }, { addressId: addr.id }, undefined, { idempotencyKey: `${key}-other` });
    expect(other.id).not.toBe(first.id);                                                               // a different key is a different order
  }, 60000);

  it('an order the server refuses (nothing in it) is an error with its reason, never a half-placed order', async () => {
    await expect(placeOrder([], { guestEmail: 'x@example.com' }, { address: { recipientName: 'G', phone: '1', country: 'Oman', city: 'C', streetAddress: 'S' } })).rejects.toThrow(/./);
  }, 30000);
});
