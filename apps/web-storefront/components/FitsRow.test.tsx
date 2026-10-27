import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { FitGroup } from "@/lib/api";

// The "Fits" row of the Technical Specifications card: three models to start with, "+N more models · M vehicles in all" opens the rest, "Show fewer" closes it.
import FitsRow, { FIT_LINES } from "./FitsRow";
import { LangProvider } from "./LangProvider";

const g = (model: string, ranges: Array<[number, number]>, over: Partial<FitGroup> = {}): FitGroup => ({ brand: "BYD", model, ranges, vehicleCount: 1, ...over });
const five = [g("Seal", [[2022, 2024]]), g("Dolphin", [[2023, 2023]]), g("Han", [[2021, 2023]]), g("Tang", [[2022, 2022]]), g("Atto 3", [[2022, 2024]])];
const show = (props: React.ComponentProps<typeof FitsRow>, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}><FitsRow {...props} /></LangProvider>);
const lines = () => screen.queryAllByTestId("fit-line").map((l) => l.textContent);

describe("a short list", () => {
  it("up to three models are all shown, each with its years, and there is no \"more\" link", () => {
    show({ groups: five.slice(0, 3), groupCount: 3, vehicleCount: 7 }); expect(lines()).toEqual(["BYD Seal2022–2024", "BYD Dolphin2023", "BYD Han2021–2023"]); expect(screen.queryByRole("button")).not.toBeInTheDocument(); expect(FIT_LINES).toBe(3);
  });
  it("one model is one line", () => { show({ groups: [five[0]], groupCount: 1, vehicleCount: 3 }); expect(lines()).toEqual(["BYD Seal2022–2024"]); expect(screen.queryByRole("button")).not.toBeInTheDocument(); });
});
describe("a long list", () => {
  it("starts with three lines and a link that says how many more models and how many vehicles in all", () => {
    show({ groups: five, groupCount: 5, vehicleCount: 11 }); expect(lines()).toHaveLength(3); const b = screen.getByRole("button"); expect(b).toHaveTextContent("+2 more models · 11 vehicles in all"); expect(b.getAttribute("aria-expanded")).toBe("false");
  });
  it("one model behind the link says \"+1 more model\" (singular)", () => { show({ groups: five.slice(0, 4), groupCount: 4, vehicleCount: 9 }); expect(screen.getByRole("button")).toHaveTextContent("+1 more model · 9 vehicles in all"); });
  it("opening shows every model, and the link becomes \"Show fewer\", which closes it again", () => {
    show({ groups: five, groupCount: 5, vehicleCount: 11 }); fireEvent.click(screen.getByRole("button")); expect(lines()).toHaveLength(5); expect(lines()[4]).toBe("BYD Atto 32022–2024"); expect(screen.getByRole("button")).toHaveTextContent("Show fewer"); expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button")); expect(lines()).toHaveLength(3); expect(screen.getByRole("button")).toHaveTextContent("+2 more models");
  });
  it("without a vehicle count the link just says how many more models", () => { show({ groups: five, groupCount: 5 }); expect(screen.getByRole("button").textContent).toBe("+2 more models"); });
  it("when the server sent only part of a very long list, the rest is counted: the link uses the real number and the open list ends with how many are not shown", () => {
    show({ groups: five, groupCount: 80, vehicleCount: 300 }); expect(screen.getByRole("button")).toHaveTextContent("+77 more models · 300 vehicles in all"); expect(screen.queryByTestId("fit-unlisted")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button")); expect(screen.getByTestId("fit-unlisted")).toHaveTextContent("+75 more models");
  });
});
describe("looks and languages", () => {
  it("each line is the model in bold and the years in the muted colour; the block is aligned to the end (it mirrors in Arabic)", () => {
    show({ groups: five.slice(0, 1), groupCount: 1 }); const line = screen.getByTestId("fit-line"); expect(line.firstElementChild!.textContent).toBe("BYD Seal"); expect(line.lastElementChild!.className).toContain("text-muted"); expect(screen.getByTestId("fits-row").className).toContain("items-end");
  });
  it("in Arabic: Arabic model names, Arabic words on the link", () => {
    const ar = five.map((x) => ({ ...x, brandAr: "بي واي دي", modelAr: `م-${x.model}` })); show({ groups: ar, groupCount: 5, vehicleCount: 11 }, "ar"); expect(lines()[0]).toBe("بي واي دي م-Seal2022–2024"); expect(screen.getByRole("button")).toHaveTextContent("+2 موديلات أخرى · 11 مركبة إجمالاً");
    fireEvent.click(screen.getByRole("button")); expect(screen.getByRole("button")).toHaveTextContent("عرض أقل");
  });
  it("each line has its own key (two models never share one)", () => { const { container } = show({ groups: five, groupCount: 5 }); expect(within(container).getAllByTestId("fit-line")).toHaveLength(3); });
});
