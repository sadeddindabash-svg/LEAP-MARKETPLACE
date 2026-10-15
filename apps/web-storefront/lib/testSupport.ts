// Shared by the tests that run against a REAL backend (the *.integration.test.* files). Never imported by the app itself.
//
// Those tests place real orders, and every order uses up stock, so on a database that has been tested a few times the products run dry (that is what made "No real product
// with enough stock" fail on a developer's machine). So instead of hoping some product has stock, the tests ask for one here: a product that is on sale (so it can be priced
// and ordered) with plenty in stock, restocked through the supplier's own API when it has run low.
import { fetchProducts, type ProductSummary } from "./api";

const BACKEND_URL = "http://localhost:4000";
const PLENTY = 50;            // enough that a whole test run never uses it up
const RESTOCK_TO = 500;

/**
 * A product that can be ordered with at least `minStock` (and at least 50) in stock, priced at `minPrice` or more.
 * When no on-sale product has that much left, one of the seeded supplier's own on-sale products (supplier@leap.dev) is restocked to 500.
 */
export async function stockedProduct(minPrice = 0, minStock = 5): Promise<ProductSummary> {
  const wanted = Math.max(PLENTY, minStock);
  const visible = await fetchProducts();                                                 // only products that can be priced and bought are listed
  const fits = (p: ProductSummary) => p.price > 0 && p.price >= minPrice;
  const plenty = visible.find((p) => fits(p) && p.stockQuantity >= wanted);
  if (plenty) return plenty;

  const login = await fetch(`${BACKEND_URL}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "supplier@leap.dev", password: "supplier_dev_password_123" }) });
  if (login.ok) {
    const { token } = await login.json();
    const auth = { Authorization: `Bearer ${token}` };
    const mine: Array<{ id: string }> = await (await fetch(`${BACKEND_URL}/supplier/me/products`, { headers: auth })).json().catch(() => []);
    const mineIds = new Set(mine.map((p) => p.id));
    const candidate = visible.find((p) => fits(p) && mineIds.has(p.id));
    if (candidate) {
      const res = await fetch(`${BACKEND_URL}/supplier/me/products/${candidate.id}`, { method: "PATCH", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ stockQuantity: RESTOCK_TO }) });
      if (res.ok) return { ...candidate, stockQuantity: RESTOCK_TO };
    }
  }
  const any = visible.find((p) => fits(p) && p.stockQuantity >= minStock);
  if (any) return any;
  throw new Error(`No product with at least ${minStock} in stock (price ${minPrice} or more), and none of the seeded supplier's (supplier@leap.dev) could be restocked: reseed the database, or restock a product by hand.`);
}
