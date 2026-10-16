import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// END TO END: the REAL garage page with the REAL providers against the REAL server, through the whole cycle: full, remove one, add one.
const BACKEND = "http://localhost:4000";
const up = await (async () => { try { return (await fetch(`${BACKEND}/health`)).ok; } catch { return false; } })();

import { AuthProvider } from "@/components/AuthProvider";
import { GarageProvider } from "@/components/GarageProvider";
import { LangProvider } from "@/components/LangProvider";
import GaragePage from "./garage/page";
import { addVehicleToGarage, fetchMyGarage } from "@/lib/api";

const T = { timeout: 25000 };
let n = 0;
const clearCookies = () => { for (const c of document.cookie.split("; ")) document.cookie = `${c.split("=")[0]}=; path=/; max-age=0`; };
async function buyerWithCars(count: number) {
  const res = await fetch(`${BACKEND}/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `e2e-garage-${Date.now()}-${++n}@leap.dev`, password: "e2e_garage_pw_123" }) });
  const { token } = await res.json();
  for (const year of [2015, 2016, 2017, 2018, 2019].slice(0, count)) await addVehicleToGarage(token, "gen_bmw_1_series_f20", year);
  document.cookie = `leap_auth_token=${encodeURIComponent(token)}; path=/`;
  return token as string;
}
const shell = () => render(<LangProvider lang="en"><AuthProvider><GarageProvider><GaragePage /></GarageProvider></AuthProvider></LangProvider>);
const choose = (label: string, text: string) => { const select = screen.getByLabelText(label) as HTMLSelectElement; const option = [...select.options].find((o) => o.textContent === text); if (!option) throw new Error(`no option "${text}" in ${label}`); fireEvent.change(select, { target: { value: option.value } }); };

beforeEach(() => clearCookies());

describe.runIf(up)("garage limit end to end: the real garage page against the real server", () => {
  it("CRITICAL: a full garage (5) shows '5 of 5' and the 'full' note instead of the form; removing one brings the form back; adding one fills it again", async () => {
    const token = await buyerWithCars(5);
    shell();
    expect(await screen.findByText(/· 5 of 5/, undefined, T)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your garage is full" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to my garage" })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Remove/ })[0]);
    expect(await screen.findByText(/· 4 of 5/, undefined, T)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Add to my garage" }, T)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Your garage is full" })).not.toBeInTheDocument();

    await waitFor(() => expect((screen.getByLabelText("Brand") as HTMLSelectElement).options.length).toBeGreaterThan(1), T);
    choose("Brand", "Toyota");
    await waitFor(() => expect([...(screen.getByLabelText("Model") as HTMLSelectElement).options].some((o) => o.textContent === "Camry")).toBe(true), T);
    choose("Model", "Camry");
    await waitFor(() => expect([...(screen.getByLabelText("Year") as HTMLSelectElement).options].some((o) => o.textContent === "2019")).toBe(true), T);
    choose("Year", "2019");
    fireEvent.click(screen.getByRole("button", { name: "Add to my garage" }));
    expect(await screen.findByText(/· 5 of 5/, undefined, T)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Your garage is full" }, T)).toBeInTheDocument();
    expect(await fetchMyGarage(token)).toHaveLength(5);                                                     // and the server agrees
  }, 120000);
});
