import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// A menu panel is placed against the menu button by default; a wide panel can ask to be placed against a bigger container instead (rootClassName="" takes the button's own positioning away).
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
import NavDropdown from "./NavDropdown";

const root = (props: { rootClassName?: string }) => render(<NavDropdown trigger="Menu" triggerClassName="t" panelClassName="p" {...props}><a href="/x">x</a></NavDropdown>).container.firstElementChild as HTMLElement;

describe("NavDropdown root", () => {
  it("is positioned (relative) by default, as it always was", () => { expect(root({}).className).toBe("group relative"); });
  it("can be left unpositioned, so the panel is placed against the container around it", () => {
    const el = root({ rootClassName: "" }); expect(el.className.split(" ")).not.toContain("relative"); expect(el.className.split(" ")).toContain("group");
  });
  it("can take any other positioning", () => { expect(root({ rootClassName: "static" }).className).toBe("group static"); });
});
