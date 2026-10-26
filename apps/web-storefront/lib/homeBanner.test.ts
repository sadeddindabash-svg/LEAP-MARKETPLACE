import { describe, it, expect } from "vitest";
import { slideImage, slideAlt, slideLink, slideSeconds, viewSlides, type BannerSlide } from "./homeBanner";

// The banner's slides as the website needs them: the photo for the language, where it leads, how long it stays.
const slide = (over: Partial<BannerSlide> = {}): BannerSlide => ({ id: "s1", imageEn: "/uploads/en.png", imageAr: "/uploads/ar.png", altEn: "Sale", altAr: "تخفيضات", link: { type: "none", value: "" }, seconds: 5, ...over });
const resolve = (u: string) => `https://api.example.com${u}`;

describe("which photo", () => {
  it("the English photo on the English site and the Arabic photo on the Arabic site", () => { expect(slideImage(slide(), "en")).toBe("/uploads/en.png"); expect(slideImage(slide(), "ar")).toBe("/uploads/ar.png"); });
  it("the other language's photo when this one is missing (an ad is never left blank)", () => { expect(slideImage(slide({ imageAr: null }), "ar")).toBe("/uploads/en.png"); expect(slideImage(slide({ imageEn: null }), "en")).toBe("/uploads/ar.png"); expect(slideImage(slide({ imageAr: "  " }), "ar")).toBe("/uploads/en.png"); });
  it("nothing when there is no photo at all", () => { expect(slideImage(slide({ imageEn: null, imageAr: null }), "en")).toBeNull(); expect(slideImage(slide({ imageEn: "", imageAr: " " }), "ar")).toBeNull(); });
});
describe("the description of the photo", () => {
  it("in the language, else the other language's, else empty (which marks the photo as decoration)", () => { expect(slideAlt(slide(), "en")).toBe("Sale"); expect(slideAlt(slide(), "ar")).toBe("تخفيضات"); expect(slideAlt(slide({ altAr: "" }), "ar")).toBe("Sale"); expect(slideAlt(slide({ altEn: "", altAr: "" }), "en")).toBe(""); });
});
describe("where a slide leads", () => {
  it("a part: its page; a category: the search of that category (both inside the site, ids made safe)", () => {
    expect(slideLink({ type: "part", value: "p 1/2" })).toEqual({ href: "/products/p%201%2F2", external: false }); expect(slideLink({ type: "category", value: "brake" })).toEqual({ href: "/search?category=brake", external: false }); expect(slideLink({ type: "category", value: "a&b" })!.href).toBe("/search?category=a%26b");
  });
  it("a web page: the address as it is, in a new tab (external)", () => { expect(slideLink({ type: "url", value: "https://example.com/sale?x=1" })).toEqual({ href: "https://example.com/sale?x=1", external: true }); expect(slideLink({ type: "url", value: "http://example.com" })!.external).toBe(true); });
  it("no link, an empty value, or an address that is not http(s) (never a script): nothing", () => {
    for (const l of [{ type: "none", value: "" }, { type: "part", value: "" }, { type: "part", value: "  " }, { type: "url", value: "javascript:alert(1)" }, { type: "url", value: "data:text/html,x" }, { type: "url", value: "//evil.example" }, { type: "url", value: "/relative" }, { type: "url", value: "not a url" }, { type: "teleport", value: "x" }, null, undefined]) expect(slideLink(l as never), JSON.stringify(l)).toBeNull();
  });
});
describe("seconds", () => { it("whole seconds from 2 to 30; anything else is brought into that range (5 when it is not a number)", () => { expect([slideSeconds(5), slideSeconds(2), slideSeconds(30), slideSeconds(0), slideSeconds(1), slideSeconds(99), slideSeconds(2.6), slideSeconds(NaN), slideSeconds("x" as never)]).toEqual([5, 2, 30, 2, 2, 30, 3, 5, 5]); }); });
describe("the slides to draw", () => {
  it("only slides with a photo, in the admin's order, with the photo for the language made absolute, its description, link and seconds", () => {
    const banner = { slides: [slide({ id: "a", link: { type: "part", value: "p1" }, seconds: 3 }), slide({ id: "b", imageEn: null, imageAr: null }), slide({ id: "c", imageEn: null, imageAr: "/uploads/only-ar.png", link: { type: "url", value: "https://example.com" }, seconds: 8 })] };
    expect(viewSlides(banner, "en", resolve)).toEqual([{ id: "a", src: "https://api.example.com/uploads/en.png", alt: "Sale", href: "/products/p1", external: false, seconds: 3 }, { id: "c", src: "https://api.example.com/uploads/only-ar.png", alt: "Sale", href: "https://example.com", external: true, seconds: 8 }]);
    expect(viewSlides(banner, "ar", resolve)[0]).toMatchObject({ src: "https://api.example.com/uploads/ar.png", alt: "تخفيضات" });
  });
  it("no banner, or no slides: nothing", () => { expect(viewSlides(null, "en", resolve)).toEqual([]); expect(viewSlides(undefined, "en", resolve)).toEqual([]); expect(viewSlides({ slides: [] }, "en", resolve)).toEqual([]); });
});
