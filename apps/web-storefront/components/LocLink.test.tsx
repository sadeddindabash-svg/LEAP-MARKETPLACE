import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LocLink from "./LocLink";
import { LangProvider } from "./LangProvider";

const hrefOf = (label: string) => screen.getByText(label).closest("a")?.getAttribute("href");

describe("LocLink keeps the visitor's language", () => {
  it("CRITICAL: in Arabic every internal link gets the /ar prefix; full addresses and anchors are left alone", () => {
    render(<LangProvider lang="ar"><LocLink href="/cart">cart</LocLink><LocLink href="/">home</LocLink><LocLink href="/search?category=brake">search</LocLink>
      <LocLink href="https://example.com/x">external</LocLink><LocLink href="#top">anchor</LocLink><LocLink href={{ pathname: "/orders/5", query: { a: "1" } }}>object</LocLink></LangProvider>);
    expect(hrefOf("cart")).toBe("/ar/cart");
    expect(hrefOf("home")).toBe("/ar");
    expect(hrefOf("search")).toBe("/ar/search?category=brake");
    expect(hrefOf("external")).toBe("https://example.com/x");
    expect(hrefOf("anchor")).toBe("#top");
    expect(hrefOf("object")).toBe("/ar/orders/5?a=1");
  });

  it("in English (and with no provider at all) links are exactly what they were written as", () => {
    render(<LangProvider lang="en"><LocLink href="/cart">cart</LocLink></LangProvider>);
    expect(hrefOf("cart")).toBe("/cart");
  });
});
