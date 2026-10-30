import { afterEach, describe, expect, it } from "vitest";
import { apiMessage, setApiLanguage } from "./serverMessages";

// The server's English messages in the supplier's language.
describe("server messages in Chinese", () => {
  afterEach(() => setApiLanguage("zh"));
  it("known messages are translated, with their numbers and fields", () => {
    setApiLanguage("zh");
    expect(apiMessage("Missing required field(s): category, weightKg")).toBe("缺少必填项：分类、重量");
    expect(apiMessage("Exactly 3 product photos are required (got 2). Upload via POST /uploads/product-image first.")).toBe("需要正好 3 张商品照片（现有 2 张）");
    expect(apiMessage("itemName in English must be at least 15 characters (got 12)")).toBe("商品名称（英文）至少需要 15 个字符（现有 12 个）");
    expect(apiMessage("Your session has expired. Please log in again.")).toBe("您的登录已过期，请重新登录。");
    expect(apiMessage("Request failed (500)")).toBe("请求失败（500）");
  });
  it("an unknown message is shown with a Chinese prefix, never hidden", () => {
    setApiLanguage("zh");
    expect(apiMessage("Something new happened")).toBe("服务器提示：Something new happened");
  });
  it("in English nothing changes", () => {
    setApiLanguage("en");
    expect(apiMessage("Missing required field(s): category")).toBe("Missing required field(s): category");
  });
});
