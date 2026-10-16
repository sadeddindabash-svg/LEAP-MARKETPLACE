import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ path: "/search" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }));
import NavDropdown from "./NavDropdown";

// jsdom has no PointerEvent: a stand-in that carries the pointer type ("mouse" or "touch"), which the menu needs
class FakePointerEvent extends MouseEvent { pointerType: string; constructor(type: string, init: MouseEventInit & { pointerType?: string } = {}) { super(type, init); this.pointerType = init.pointerType ?? "mouse"; } }
beforeEach(() => { nav.path = "/search"; vi.stubGlobal("PointerEvent", FakePointerEvent); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const Menu = ({ name = "Sections" }: { name?: string }) => (
  <NavDropdown trigger={<span>{name}</span>} triggerClassName="t" panelClassName="p">
    <a href="/a">Brakes</a><a href="/b">Filters</a><button type="button">Sign out</button><p>just text</p>
  </NavDropdown>
);
const show = (extra?: React.ReactNode) => render(<div><Menu />{extra}<button type="button">elsewhere</button></div>);
const trigger = (name = "Sections") => screen.getByRole("button", { name });
const panel = () => document.getElementById(trigger().getAttribute("aria-controls") as string) as HTMLElement;
const open = () => fireEvent.click(trigger());
const pointer = (type: string, target: Element, pointerType = "mouse") => fireEvent(target, new FakePointerEvent(type, { bubbles: true, pointerType }));

describe("a menu that closes by itself", () => {
  it("CRITICAL: is closed at first, but its links are IN THE PAGE (hidden, not removed): that is how search engines find the pages behind the menu", () => {
    show();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(panel().hidden).toBe(true);
    expect(panel().querySelectorAll("a")).toHaveLength(2);
  });
  it("a click on its button opens it, another closes it; the button points at the panel", () => {
    show();
    open();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(panel().hidden).toBe(false);
    open();
    expect(panel().hidden).toBe(true);
  });
  it("CRITICAL: a click or tap ANYWHERE ELSE closes it; a click inside it does not", () => {
    show();
    open();
    pointer("pointerdown", panel().querySelector("p") as Element);
    expect(panel().hidden).toBe(false);                                           // inside: stays open
    pointer("pointerdown", screen.getByRole("button", { name: "elsewhere" }), "touch");
    expect(panel().hidden).toBe(true);
  });
  it("Escape closes it and puts the focus back on its button", () => {
    show();
    open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(panel().hidden).toBe(true);
    expect(document.activeElement).toBe(trigger());
  });
  it("CRITICAL: choosing a link or a button in it closes it (the page is about to change); clicking its empty padding does not", () => {
    show();
    open();
    fireEvent.click(panel().querySelector("p") as Element);
    expect(panel().hidden).toBe(false);
    fireEvent.click(screen.getByText("Brakes"));
    expect(panel().hidden).toBe(true);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(panel().hidden).toBe(true);
  });
  it("CRITICAL: moving to another page closes it, with nothing for the page to do", () => {
    const { rerender } = show();
    open();
    expect(panel().hidden).toBe(false);
    nav.path = "/orders";
    rerender(<div><Menu /><button type="button">elsewhere</button></div>);
    expect(panel().hidden).toBe(true);
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });
  it("tabbing to something outside closes it; moving between its own items does not", () => {
    show();
    open();
    const first = screen.getByText("Brakes");
    fireEvent.blur(trigger(), { relatedTarget: first });
    expect(panel().hidden).toBe(false);
    fireEvent.blur(first, { relatedTarget: screen.getByRole("button", { name: "elsewhere" }) });
    expect(panel().hidden).toBe(true);
  });
  it("CRITICAL: with a MOUSE, moving away hides it after a third of a second, and coming back in time keeps it; a TOUCH screen has no 'moving away'", () => {
    show();
    const box = trigger().parentElement as Element;
    open();
    pointer("pointerout", box);
    act(() => { vi.advanceTimersByTime(250); });
    expect(panel().hidden).toBe(false);                                           // not yet
    pointer("pointerover", box);                                                    // back in time
    act(() => { vi.advanceTimersByTime(500); });
    expect(panel().hidden).toBe(false);
    pointer("pointerout", box);
    act(() => { vi.advanceTimersByTime(350); });
    expect(panel().hidden).toBe(true);                                              // away long enough
    open();
    pointer("pointerout", box, "touch");
    act(() => { vi.advanceTimersByTime(1000); });
    expect(panel().hidden).toBe(false);                                             // a finger lifting is not "moving away"
  });
  it("only one menu is open at a time: opening another closes the first", () => {
    render(<div><Menu name="Sections" /><Menu name="Account" /></div>);
    fireEvent.click(trigger("Sections"));
    expect(document.getElementById(trigger("Sections").getAttribute("aria-controls") as string)?.hidden).toBe(false);
    pointer("pointerdown", trigger("Account"));
    fireEvent.click(trigger("Account"));
    expect(document.getElementById(trigger("Sections").getAttribute("aria-controls") as string)?.hidden).toBe(true);
    expect(document.getElementById(trigger("Account").getAttribute("aria-controls") as string)?.hidden).toBe(false);
  });
});
