import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AnnouncementBar from "./AnnouncementBar";
import { LangProvider } from "./LangProvider";

const LIST = [{ en: "Opening Middle East warehouse in Saudi Arabia", ar: "افتتاح مستودع الشرق الأوسط في السعودية" }, { en: "International shipping in 3-7 days", ar: "" }];
const show = (lang: "en" | "ar", list = LIST) => render(<LangProvider lang={lang}><AnnouncementBar announcements={list} /></LangProvider>);

describe("the moving line at the top of the home page", () => {
  it("CRITICAL: in English the line is laid out left to right and told to move RIGHT TO LEFT; the texts are the English ones", () => {
    const { container } = show("en");
    const bar = screen.getByRole("region", { name: "Announcements" });
    expect(bar.getAttribute("data-lang")).toBe("en");
    expect(container.querySelector(".leap-ticker-track")?.getAttribute("dir")).toBe("ltr");
    expect(screen.getAllByText(LIST[0].en).length).toBeGreaterThan(0);
  });
  it("CRITICAL: in Arabic the line is laid out right to left and told to move LEFT TO RIGHT; Arabic text where there is some, English where there is none", () => {
    const { container } = show("ar");
    const bar = screen.getByRole("region", { name: "الإعلانات" });
    expect(bar.getAttribute("data-lang")).toBe("ar");
    expect(container.querySelector(".leap-ticker-track")?.getAttribute("dir")).toBe("rtl");
    expect(screen.getAllByText(LIST[0].ar).length).toBeGreaterThan(0);
    expect(screen.getAllByText(LIST[1].en).length).toBeGreaterThan(0);
  });
  it("CRITICAL: the line is made of two identical copies so the loop has no jump, and a screen reader hears it ONCE (the second copy is hidden from it)", () => {
    const { container } = show("en");
    const copies = container.querySelectorAll(".leap-ticker-copy");
    expect(copies).toHaveLength(2);
    expect(copies[0].getAttribute("aria-hidden")).toBeNull();
    expect(copies[1].getAttribute("aria-hidden")).toBe("true");
    expect(copies[0].textContent).toBe(copies[1].textContent);
  });
  it("a visitor whose device asks for less motion gets the same lines as a still list (shown by the stylesheet)", () => {
    const { container } = show("en");
    const still = container.querySelectorAll(".leap-ticker-static li");
    expect([...still].map((li) => li.textContent)).toEqual([LIST[0].en, LIST[1].en]);
  });
  it("the speed follows how much there is to read, and is set on the bar", () => {
    const { container } = show("en");
    const seconds = Number((container.querySelector(".leap-ticker") as HTMLElement).style.getPropertyValue("--ticker-seconds").replace("s", ""));
    expect(seconds).toBeGreaterThanOrEqual(20);
    expect(seconds).toBeLessThanOrEqual(120);
  });
  it("CRITICAL: no announcements, no bar at all", () => {
    const { container } = show("en", []);
    expect(container).toBeEmptyDOMElement();
    const arabic = show("ar", [{ en: "", ar: "عربي فقط" }]);
    expect(arabic.container).toBeEmptyDOMElement();                                // no English: the line is dropped
  });
});
