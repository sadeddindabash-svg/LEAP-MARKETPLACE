import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SafeImage from "./SafeImage";

describe("a photo that cannot be loaded", () => {
  it("CRITICAL: disappears (leaving the frame behind it) instead of showing the browser's broken-image icon; a photo that loads stays", () => {
    render(<div data-testid="frame"><SafeImage src="/missing.jpg" alt="Brake disc" width={40} height={40} unoptimized /></div>);
    const photo = screen.getByAltText("Brake disc");
    expect(photo).toBeInTheDocument();
    fireEvent.error(photo);                                                  // the file did not load
    expect(screen.queryByAltText("Brake disc")).not.toBeInTheDocument();
    expect(screen.getByTestId("frame")).toBeInTheDocument();                // the frame stays: the layout does not change
  });
  it("the caller's own error handler still runs", () => {
    let called = 0;
    render(<SafeImage src="/missing.jpg" alt="x" width={10} height={10} unoptimized onError={() => { called += 1; }} />);
    fireEvent.error(screen.getByAltText("x"));
    expect(called).toBe(1);
  });
});
