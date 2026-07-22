import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { CartProvider, useCart } from './CartProvider';
import CartIcon from './CartIcon';

// Second real test in this app's brand-new test suite -- a component-
// level test (mocked fetch, jsdom), proving the OTHER half of the
// toolchain works too, not just the real-backend integration style in
// lib/api.integration.test.ts. Mirrors the exact mocked-fetch pattern
// already used throughout apps/admin-dashboard's test suite.

function mockFetch(cart: { cartId: string; items: unknown[] }) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => cart,
  });
}

function TestHarness() {
  const { addItem } = useCart();
  return (
    <div>
      <CartIcon />
      <button onClick={() => addItem('p1', 1)}>Add</button>
    </div>
  );
}

describe('CartProvider + CartIcon', () => {
  beforeEach(() => {
    document.cookie = 'leap_cart_id=; path=/; max-age=0'; // clear between tests, same isolation reasoning as clearing storage elsewhere in this project
  });

  it('shows no badge when the real cart is empty', async () => {
    globalThis.fetch = mockFetch({ cartId: 'test', items: [] });
    render(
      <CartProvider>
        <CartIcon />
      </CartProvider>
    );
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('CRITICAL: adding a real item updates the badge count without a page reload', async () => {
    let currentCart = { cartId: 'test', items: [] as { productId: string; quantity: number; name: string; price: number; currencyCode: string; supplierName: string | null }[] };
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        currentCart = { cartId: 'test', items: [{ productId: 'p1', quantity: 1, name: 'Test Part', price: 10, currencyCode: 'USD', supplierName: 's1' }] };
      }
      return { ok: true, json: async () => currentCart };
    });

    render(
      <CartProvider>
        <TestHarness />
      </CartProvider>
    );

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByText('1')).not.toBeInTheDocument();

    act(() => {
      screen.getByText('Add').click();
    });

    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
  });
});
