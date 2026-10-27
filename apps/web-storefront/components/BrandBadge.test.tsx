import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// The brand logo in the corner of a product's photo.
vi.mock("next/image", () => ({ default: (p: { src: string; alt: string; onError?: () => void; className?: string }) => <img data-testid="logo" src={p.src} alt={p.alt} className={p.className} onError={p.onError} /> }));
import BrandBadge from "./BrandBadge";

describe("the brand logo", () => {
  it("is the brand's logo, named by the brand (for screen readers), fitted WHOLE inside a small white circle in the start corner", () => {
    render(<BrandBadge src="https://api.example.com/uploads/byd.png" name="BYD" />); const img = screen.getByAltText("BYD"); expect(img.getAttribute("src")).toBe("https://api.example.com/uploads/byd.png"); expect(img.className).toContain("object-contain");
    const badge = screen.getByTestId("brand-badge"); for (const c of ["absolute", "start-2.5", "top-2.5", "size-10", "rounded-full", "bg-white"]) expect(badge.className.split(" "), c).toContain(c);
  });
  it("a logo that cannot be loaded is not drawn at all (no empty circle is left)", () => { render(<BrandBadge src="/x.png" name="BYD" />); fireEvent.error(screen.getByTestId("logo")); expect(screen.queryByTestId("brand-badge")).not.toBeInTheDocument(); });
});
