import { describe, it, expect } from "vitest";
import { filterHref, modelYears, noCar, pricePresets, readExtraFilters, roundNice, toUsd } from "./searchFilters";

const read = (o: Record<string, string>) => readExtraFilters((n) => o[n]);

describe("the sort, price and delivery filters in the address", () => {
  it("CRITICAL: reads the known values and ignores anything else", () => {
    expect(read({ sort: "price_desc", minPrice: "26.67", maxPrice: "80", maxDeliveryDays: "7" })).toEqual({ sort: "price_desc", minPrice: 26.67, maxPrice: 80, maxDeliveryDays: 7 });
    expect(read({ sort: "drop table", minPrice: "-5", maxPrice: "abc", maxDeliveryDays: "2.5" })).toEqual({});
    expect(read({ minPrice: "50", maxPrice: "10" })).toEqual({ minPrice: 50 });             // a maximum below the minimum is dropped
    expect(read({ maxDeliveryDays: "999" })).toEqual({});
  });

  it("CRITICAL: a new filter keeps the others and starts again at page 1; a new section drops its old part", () => {
    const now = new URLSearchParams("q=pads&category=brake&part=Brake Pads&generationId=g1&year=2019&page=4&sort=newest");
    expect(filterHref(now, { maxPrice: 80 })).toBe("/search?q=pads&category=brake&part=Brake+Pads&generationId=g1&year=2019&sort=newest&maxPrice=80");
    expect(filterHref(now, { category: "engine" })).toBe("/search?q=pads&category=engine&generationId=g1&year=2019&sort=newest");
    expect(filterHref(now, { q: null, category: null, part: null, sort: null })).toBe("/search?generationId=g1&year=2019");
    expect(filterHref(new URLSearchParams(), {})).toBe("/search");
  });

  it("prices typed in another currency become dollars, and the quick prices are round in that currency", () => {
    expect(toUsd(100, 3.75)).toBe(26.67); expect(toUsd(40, 1)).toBe(40); expect(toUsd(40, 0)).toBe(40);
    expect(pricePresets(3.75)).toEqual([100, 300, 500]);
    expect(pricePresets(1)).toEqual([25, 75, 150]);
    expect(roundNice(0)).toBe(0); expect(roundNice(93.75)).toBe(100);
  });
});

describe("the car, step by step", () => {
  it("the years of a model come from its generations, newest first, each once (a generation still made runs to this year)", () => {
    expect(modelYears([{ yearStart: 2020, yearEnd: null }, { yearStart: 2018, yearEnd: 2020 }], 2022)).toEqual([2022, 2021, 2020, 2019, 2018]);
    expect(modelYears([])).toEqual([]);
  });
  it("clearing the car removes every part of it, and keeps the rest", () => {
    const now = new URLSearchParams("category=lights&brandId=changan&modelId=cs75&generationId=g2&year=2022&versionId=v1&sort=newest");
    expect(filterHref(now, noCar())).toBe("/search?category=lights&sort=newest");
    expect(filterHref(now, { ...noCar(), brandId: "geely" })).toBe("/search?category=lights&brandId=geely&sort=newest");
  });
});
