import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ProductSummary } from "@/lib/api";

vi.mock("@/components/Price", () => ({ Price: ({ usd }: { usd: number }) => <span>${usd}</span> }));
vi.mock("@/lib/api", async () => ({ resolveImageUrl: (u: string) => `http://api${u}` }));
import ProductCard from "./ProductCard";
import { LangProvider } from "./LangProvider";

const product = (over: Partial<ProductSummary> = {}): ProductSummary => ({ id: "p1", name: "Wiper blade 26 in", images: ["/uploads/w.jpg"], price: 12, stockQuantity: 5, oemNumber: "61610044", estimatedDeliveryDays: 7, ...over } as ProductSummary);
const show = (p: ProductSummary) => render(<LangProvider lang="en"><ul><ProductCard product={p} lang="en" /></ul></LangProvider>);

describe("the product card photo", () => {
  it("CRITICAL: is a true SQUARE (never the old fixed-height rectangle) and draws the WHOLE part inside a margin, not cropped", () => {
    const { container } = show(product());
    const frame = container.querySelector("a > div") as HTMLElement;
    expect(frame.className).toContain("aspect-square");
    expect(frame.className).not.toMatch(/\bh-\d/);
    const photo = screen.getByAltText("Wiper blade 26 in");
    expect(photo.className).toContain("object-contain");                       // the whole part is visible
    expect(photo.className).not.toContain("object-cover");                     // never cut the edges off
    expect(photo.parentElement?.className).toContain("inset-2");               // with a small margin around it
    expect(photo.getAttribute("src")).toContain("http://api/uploads/w.jpg");
  });
  it("with no photo the icon is centred in the same square, on grey", () => {
    const { container } = show(product({ images: [] }));
    const frame = container.querySelector("a > div") as HTMLElement;
    expect(frame.className).toContain("aspect-square");
    expect(frame.className).toContain("bg-[#e6edf2]");
    expect(container.querySelector("a > div svg")).not.toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });
  it("a photo that fails to load leaves the empty square instead of a broken-image icon, and the rest of the card is unchanged", () => {
    const { container } = show(product());
    fireEvent.error(screen.getByAltText("Wiper blade 26 in"));
    expect(screen.queryByAltText("Wiper blade 26 in")).not.toBeInTheDocument();
    expect((container.querySelector("a > div") as HTMLElement).className).toContain("aspect-square");
    expect(screen.getByText("Wiper blade 26 in")).toBeInTheDocument();         // the name (as the card title)
    expect(screen.getByText("61610044")).toBeInTheDocument();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/products/p1");
  });
});
