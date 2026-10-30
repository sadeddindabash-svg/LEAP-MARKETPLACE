// Messages from the server (and the portal's own request errors) in the supplier's language. The server answers in English; when the
// portal is in Chinese, a known message is shown in Chinese (its numbers and names kept), and any other message is shown as
// "服务器提示：<the server's words>" so nothing is hidden. The language is set by the app (setApiLanguage) whenever the supplier switches it.
let apiLanguage = "zh";
export function setApiLanguage(lang) { apiLanguage = lang === "en" ? "en" : "zh"; }

const FIELD = {
  nameZh: "商品名称", itemName: "商品名称", category: "分类", part: "部件类型", oemNumber: "OEM 编号", price: "价格", currencyCode: "币种",
  fitment: "适配车型", weightKg: "重量", lengthCm: "长度", widthCm: "宽度", heightCm: "高度", position: "位置", stockQuantity: "库存数量",
  lowStockThreshold: "库存预警阈值", priceAdjustment: "价格调整", status: "状态", trackingNumber: "运单号", country: "国家",
  "category and part": "分类和部件类型",
};
const LANGUAGE = { English: "英文", Chinese: "中文", Arabic: "阿拉伯文" };
const fields = (list) => list.split(/,\s*|\s+and\s+/).map((f) => FIELD[f.trim()] || f.trim()).join("、");
const field = (f) => FIELD[f] || f;

// [pattern, Chinese]: the first that matches wins. $1, $2 ... are the parts the pattern captured.
const RULES = [
  [/^Your session has expired\. Please log in again\.$/, () => "您的登录已过期，请重新登录。"],
  [/^Session expired or invalid$/, () => "登录已过期或无效，请重新登录。"],
  [/^Login failed$/, () => "登录失败"],
  [/^Request failed \((\d+)\)$/, (m) => `请求失败（${m[1]}）`],
  [/^Upload failed \((\d+)\)$/, (m) => `上传失败（${m[1]}）`],
  [/^Failed to load (brands|models|generations|versions|engines|transmissions|categories|parts|drafts) \((\d+)\)$/, (m) => `无法加载${{ brands: "品牌", models: "车型", generations: "年份", versions: "车型版本", engines: "发动机", transmissions: "变速箱", categories: "分类", parts: "部件类型", drafts: "待完善的商品" }[m[1]]}（${m[2]}）`],
  [/^Could not read this video file$/, () => "无法读取此视频文件"],
  [/^Missing required field\(s\): (.+)$/, (m) => `缺少必填项：${fields(m[1])}`],
  [/^(\w+) in (English|Chinese|Arabic) must be at least (\d+) characters \(got (\d+)\)$/, (m) => `${field(m[1])}（${LANGUAGE[m[2]]}）至少需要 ${m[3]} 个字符（现有 ${m[4]} 个）`],
  [/^(\w+) must be at most (\d+) characters \(got (\d+)\)$/, (m) => `${field(m[1])}最多 ${m[2]} 个字符（现有 ${m[3]} 个）`],
  [/^(\w+) must be between (\d+) and (\d+) characters \(got (\d+)\)$/, (m) => `${field(m[1])}需为 ${m[2]}–${m[3]} 个字符（现有 ${m[4]} 个）`],
  [/^(\w+) must be a positive number$/, (m) => `${field(m[1])}必须大于 0`],
  [/^(\w+) must be a whole number of 0 or more$/, (m) => `${field(m[1])}必须是 0 或更大的整数`],
  [/^Exactly (\d+) product photos are required \(got (\d+)\)/, (m) => `需要正好 ${m[1]} 张商品照片（现有 ${m[2]} 张）`],
  [/^At most (\d+) product photos(?: are allowed)? \(got (\d+)\)/, (m) => `最多 ${m[1]} 张商品照片（现有 ${m[2]} 张）`],
  [/^A product video is required/, () => "需要上传商品视频"],
  [/^Image resolution too low \((\d+)x(\d+)\)\. Shortest side must be at least (\d+)px\.$/, (m) => `图片分辨率过低（${m[1]}×${m[2]}），最短边至少 ${m[3]} 像素`],
  [/^Could not read image dimensions/, () => "无法读取图片尺寸：文件可能已损坏或不是图片"],
  [/^Could not read video duration/, () => "无法读取视频时长：文件可能已损坏或不是视频"],
  [/^Video is too long \(([\d.]+)s\)\. Must be (\d+) seconds or less\.$/, (m) => `视频过长（${m[1]} 秒），最长 ${m[2]} 秒`],
  [/^No image file provided/, () => "未选择图片文件"],
  [/^No video file provided/, () => "未选择视频文件"],
  [/^"(.+)" is not a valid value for the attribute "(.+)"$/, (m) => `"${m[1]}" 不是属性 "${m[2]}" 的有效值`],
  [/^A product can have at most (\d+) attributes$/, (m) => `每个商品最多 ${m[1]} 个属性`],
  [/^Attribute "(.+)" was provided more than once$/, (m) => `属性 "${m[1]}" 重复`],
  [/^Each attribute needs both a name and a value$/, () => "每个属性都需要名称和值"],
  [/^Cannot import more than (\d+) items in a single batch$/, (m) => `每批最多导入 ${m[1]} 个商品`],
  [/^Repeated in this file \(same OE number as row (\d+)\): skipped$/, (m) => `文件中重复（与第 ${m[1]} 行 OE 编号相同）：已跳过`],
  [/^You already have a product with this OE number for this car/, () => "此车型（品牌、车型、年份和版本）已有此 OE 编号的商品。请在“商品管理”中修改其价格或库存。"],
  [/^This classification has no weight and size set by Leap/, () => "此部件类型尚未由 Leap 设置重量和尺寸，且此商品没有自己的重量和尺寸，因此无法移到此类型。请联系 Leap。"],
  [/^category and part are changed together: send both$/, () => "分类和部件类型需要一起修改"],
  [/^part must be a real part belonging to the given category$/, () => "部件类型必须属于所选分类"],
  [/^part must be one of: (.+)$/, (m) => `部件类型必须是以下之一：${m[1]}`],
  [/^category must be one of: (.+)$/, (m) => `分类必须是以下之一：${m[1]}`],
  [/^position must be one of: (.+)$/, (m) => `位置必须是以下之一：${m[1]}`],
  [/^Unknown category$/, () => "未知分类"],
  [/^Unknown fitment\.generationId$/, () => "未知的车型年份"],
  [/^fitment\.year (\d+) is outside this generation's range \((.+)\)$/, (m) => `年份 ${m[1]} 不在此车型的年份范围内（${m[2].replace("present", "至今")}）`],
  [/^fitment\.generationId and fitment\.year are required$/, () => "请选择品牌、车型和年份"],
  [/^fitment is required$/, () => "请选择适配车型"],
  [/^fitment\.(engineId|transmissionId) does not belong to the given generation$/, (m) => `${m[1] === "engineId" ? "发动机" : "变速箱"}不属于所选车型年份`],
  [/^fitment\.versionIds has a version that does not belong to the given generation$/, () => "所选版本不属于此车型年份"],
  [/^fitment\.versionIds can have at most (\d+) versions$/, (m) => `最多选择 ${m[1]} 个版本`],
  [/^fitment\.versionIds must be a list of version/, () => "车型版本格式不正确"],
  [/^oemNumber, itemName, and a positive price are all required$/, () => "OE 编号、商品名称和大于 0 的价格均为必填"],
  [/^currencyCode must be 'CNY'/, () => "价格必须以人民币（CNY）填写；买家看到的美元价格由系统自动计算"],
  [/^Product not found$/, () => "未找到商品"],
  [/^Draft product not found$/, () => "未找到待完善的商品"],
  [/^Sub-order not found$/, () => "未找到订单"],
  [/^Supplier not found$/, () => "未找到供应商"],
  [/^Provide at least one of: (.+)$/, (m) => `请至少修改以下一项：${fields(m[1])}`],
  [/^productIds is required and must be non-empty$/, () => "请先选择商品"],
  [/^adjustmentType must be 'percent' or 'flat'$/, () => "请选择按百分比或固定金额调整"],
  [/^adjustmentValue must be a real number$/, () => "请输入有效数字"],
  [/^priceAdjustment must be/, () => "价格调整格式不正确"],
  [/^items must be a non-empty array$/, () => "文件中没有商品"],
  [/^nameLanguage must be 'zh' or 'en'$/, () => "请选择商品名称语言"],
  [/^names must be an array of at most (\d+) item names$/, (m) => `最多 ${m[1]} 个商品名称`],
  [/^status must be one of: pending, preparing, shipped$/, () => "状态必须是：待确认、备货中或已发货"],
  [/^This sub-order has no inspection hub assigned yet/, () => "此订单尚未分配质检中心，管理员分配后才能标记为已发货。"],
  [/^This request is no longer open for new listings$/, () => "此求购已关闭，无法再添加商品"],
  [/^This item already has a listing or was marked unavailable$/, () => "此项已有商品或已标记为无货"],
  [/^Only the Leap Supplier account can fulfil a part request$/, () => "只有 Leap 供应商账户可以响应求购"],
  [/^bankName, accountNumber, and accountHolderName are all required\.?$/, () => "开户银行、账号和户名均为必填"],
  [/^country is required$/, () => "请填写国家"],
];

/** A message in the current language: the Chinese one when the portal is in Chinese, the server's words otherwise. */
export function apiMessage(message) {
  if (apiLanguage !== "zh" || !message) return message;
  const text = String(message);
  if (/[㐀-鿿]/.test(text)) return text;               // already Chinese
  for (const [pattern, toZh] of RULES) { const m = pattern.exec(text); if (m) return toZh(m); }
  return `服务器提示：${text}`;
}
/** An Error whose message is in the current language (auth.js throws these). */
export function apiError(message) { return new Error(apiMessage(message)); }
/** The locale for dates and numbers on screen: Chinese dates in Chinese ("10月30日 周五"), whatever the computer's own language is. */
export const uiLocale = () => (apiLanguage === "zh" ? "zh-CN" : "en-US");
