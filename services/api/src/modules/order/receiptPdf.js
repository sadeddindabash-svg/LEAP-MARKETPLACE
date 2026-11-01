/**
 * The ORDER RECEIPT PDF (A4), "theme B": white, thin lines, a small gold bar, the total in an outlined box. Confirmed with the person via
 * the canvas mockup before building.
 *
 *  - In the BUYER'S LANGUAGE: English, or Arabic laid out right to left.
 *  - In the BUYER'S CURRENCY: the currency and rate saved with the order when it was placed (migration 123); for an older order, the currency
 *    the buyer has chosen now, at today's rate; else US dollars.
 *  - Header: the logo, "Leap Auto Parts" centred on it, "Order receipt" under it; Order / Placed and CUSTOMER on the start side lined up with
 *    the logo, DELIVERY ADDRESS on the other side.
 *  - A long item name wraps and its row grows, so nothing touches the table lines; a long order continues on more pages, each repeating the
 *    table header, with "Page x of y".
 *  - Arabic text (a name or an address typed in Arabic) is printed with an Arabic font, joined and right to left, on the English receipt too.
 *    (`bidi` is the bidi-js instance, `reshaper` arabic-reshaper: see forPdf below for why both.)
 */
const fs = require('fs');

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const AR_SYMBOL = { SAR: 'ر.س', AED: 'د.إ', KWD: 'د.ك', QAR: 'ر.ق', BHD: 'د.ب', OMR: 'ر.ع', EGP: 'ج.م', JOD: 'د.أ', USD: '$' };
const THREE_DECIMALS = new Set(['KWD', 'BHD', 'OMR', 'JOD']);

const TEXT = {
  en: { brand: 'Leap Auto Parts', title: 'Order receipt', order: 'Order', placed: 'Placed', customer: 'CUSTOMER', address: 'DELIVERY ADDRESS', guest: 'Guest',
    item: 'Item', qty: 'Qty', unit: 'Unit price', total: 'Total', subtotal: 'Subtotal', discount: 'Discount', shipping: 'Shipping fees', grand: 'Total',
    page: (a, b) => `Page ${a} of ${b}`, continued: 'continued' },
  ar: { brand: 'ليب لقطع السيارات', title: 'إيصال الطلب', order: 'الطلب', placed: 'تاريخ الطلب', customer: 'العميل', address: 'عنوان التوصيل', guest: 'ضيف',
    item: 'الصنف', qty: 'الكمية', unit: 'سعر الوحدة', total: 'الإجمالي', subtotal: 'المجموع الفرعي', discount: 'الخصم', shipping: 'رسوم الشحن', grand: 'الإجمالي الكلي',
    page: (a, b) => `صفحة ${a} من ${b}`, continued: 'تابع' },
};

/** The currency a receipt is shown in: { code, rate } (rate = units of `code` per 1 US dollar). */
async function receiptCurrency(db, order, requested) {
  if (order.display_currency && Number(order.display_rate) > 0) return { code: order.display_currency, rate: Number(order.display_rate) };
  const code = typeof requested === 'string' ? requested.trim().toUpperCase() : '';
  if (/^[A-Z]{3}$/.test(code) && code !== 'USD') {
    const { rows } = await db.query('SELECT rate FROM fx_rates WHERE currency_pair = $1', [`USD_${code}`]);
    if (rows.length > 0 && Number(rows[0].rate) > 0) return { code, rate: Number(rows[0].rate) };
  }
  return { code: 'USD', rate: 1 };
}

function moneyFormatter(currency, isAr) {
  const digits = THREE_DECIMALS.has(currency.code) ? 3 : 2;
  return (usd) => {
    const n = (Number(usd) || 0) * currency.rate;
    const s = n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    if (isAr) return `${s} ${AR_SYMBOL[currency.code] || currency.code}`;
    return currency.code === 'USD' ? `$${s}` : `${currency.code} ${s}`;
  };
}

/**
 * Draws the receipt into a PDFKit document (created with { size: 'A4', bufferPages: true }) and ends it.
 * data: { lang, orderId, placedAt, title?, customerName, address: [lines] | null, items: [{ name, quantity, unitUsd }], discountUsd, shippingUsd,
 *         totalUsd, currency: { code, rate }, footerNote, logoPath, fonts: { arabicRegular, arabicBold } }
 */
function drawReceipt(doc, data, bidi, reshaper) {
  const isAr = data.lang === 'ar';
  const T = TEXT[isAr ? 'ar' : 'en'];
  const money = moneyFormatter(data.currency, isAr);
  const C = { ink: '#1A1D21', grey: '#5F6670', light: '#888888', line: '#E4E6EA', gold: '#F2A71B' };

  doc.registerFont('Ar', data.fonts.arabicRegular);
  doc.registerFont('Ar-Bold', data.fonts.arabicBold);
  const latin = { regular: isAr ? 'Ar' : 'Helvetica', bold: isAr ? 'Ar-Bold' : 'Helvetica-Bold' };

  const M = { top: 44, side: 46, bottom: 40 };
  const W = doc.page.width;
  const H = doc.page.height;
  const left = M.side;
  const right = W - M.side;
  const width = right - left;
  const contentBottom = H - M.bottom - 26;             // room for the footer line
  const start = isAr ? 'right' : 'left';
  const end = isAr ? 'left' : 'right';

  // Arabic in PDFKit depends on the Arabic font file:
  //  - a font WITH OpenType shaping tables: PDFKit's font engine joins the letters and draws the run right to left itself, so a line is given
  //    as the reverse of its bidi visual order (numbers and Latin come out the right way round), with no-break spaces;
  //  - a font WITHOUT them (e.g. one converted from a web font): the letters are joined here (presentation forms) and the line is given in
  //    its visual order, left to right.
  // Lines are wrapped here, word by word, in reading order, either way.
  const fontShapes = (() => {
    try {
      doc.font('Ar');
      const f = doc._font && doc._font.font;
      const scripts = f && f.GSUB && f.GSUB.scriptList;
      return Boolean(scripts && scripts.some((s) => s.tag === 'arab'));
    } catch { return false; }
  })();
  const forPdf = (line) => {
    if (fontShapes) {
      const levels = bidi.getEmbeddingLevels(line, 'rtl');
      return [...bidi.getReorderedString(line, levels)].reverse().join('').replace(/ /g, '\u00A0');
    }
    const joined = reshaper.convertArabic(line);
    return bidi.getReorderedString(joined, bidi.getEmbeddingLevels(joined, 'rtl'));
  };
  function arabicLines(raw, w) {
    const words = raw.split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const word of words) {
      const next = cur ? `${cur} ${word}` : word;
      if (cur && doc.widthOfString(forPdf(next)) > w) { lines.push(cur); cur = word; } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }

  // Writes one piece of text in the receipt's font, or an Arabic font when it contains Arabic. Returns the height it took.
  function put(text, x, y, { w, align = start, size = 10, bold = false, color = C.ink, measureOnly = false } = {}) {
    const raw = text === null || text === undefined ? '' : String(text);
    if (ARABIC.test(raw)) {
      doc.font(bold ? 'Ar-Bold' : 'Ar').fontSize(size);
      const lh = doc.currentLineHeight(true);
      const lines = arabicLines(raw, w);
      if (!measureOnly) lines.forEach((line, i) => doc.fillColor(color).text(forPdf(line), x, y + i * lh, { width: w, align, lineBreak: false }));
      return lines.length * lh;
    }
    doc.font(bold ? latin.bold : latin.regular).fontSize(size);
    const h = doc.heightOfString(raw || ' ', { width: w });
    if (!measureOnly) doc.fillColor(color).text(raw, x, y, { width: w, align, lineBreak: true });
    return h;
  }
  const hline = (y, color = C.line, lw = 1) => doc.moveTo(left, y).lineTo(right, y).lineWidth(lw).strokeColor(color).stroke();

  // ---- the table
  const qtyW = 46, unitW = 86, totW = 90, gap = 10;
  const itemW = width - qtyW - unitW - totW - gap * 3;
  const colX = isAr
    ? { tot: left, unit: left + totW + gap, qty: left + totW + unitW + gap * 2, item: left + totW + unitW + qtyW + gap * 3 }
    : { item: left, qty: left + itemW + gap, unit: left + itemW + qtyW + gap * 2, tot: left + itemW + qtyW + unitW + gap * 3 };
  const pad = 8;

  function tableHeader(y) {
    hline(y, C.ink, 1.5);
    const ty = y + 7;
    put(T.item, colX.item + (isAr ? 0 : pad), ty, { w: itemW - pad, size: 8.5, bold: true, color: C.grey });
    put(T.qty, colX.qty, ty, { w: qtyW, size: 8.5, bold: true, color: C.grey, align: 'center' });
    put(T.unit, colX.unit, ty, { w: unitW - (isAr ? 0 : pad), size: 8.5, bold: true, color: C.grey, align: end });
    put(T.total, colX.tot + (isAr ? pad : 0), ty, { w: totW - pad, size: 8.5, bold: true, color: C.grey, align: end });
    const bottom = y + 24;
    hline(bottom, C.ink, 1.5);
    return bottom;
  }

  function logo(x, y, size) {
    if (data.logoPath && fs.existsSync(data.logoPath)) doc.image(data.logoPath, x, y, { width: size, height: size });
  }

  function continuationHeader() {
    const y = M.top;
    const lx = isAr ? right - 22 : left;
    logo(lx, y, 22);
    put(T.brand, isAr ? left + width / 2 : left + 30, y + 5, { w: width / 2 - 30, size: 10, bold: true, align: start });
    put(`${T.order} ${data.orderId} · ${T.continued}`, isAr ? left : left + width / 2, y + 6, { w: width / 2, size: 8.5, color: C.grey, align: end });
    return y + 36;
  }

  // ---- page 1 header
  let y = M.top - 14;
  doc.rect(isAr ? right - 60 : left, y, 60, 4).fill(C.gold);
  y = M.top;
  const logoSize = 40;
  logo(isAr ? right - logoSize : left, y, logoSize);
  doc.font(isAr ? 'Ar-Bold' : latin.bold).fontSize(16);
  const brandH = doc.currentLineHeight();
  const brandX = isAr ? left : left + logoSize + 10;
  put(T.brand, brandX, y + (logoSize - brandH) / 2, { w: width - logoSize - 10, size: 16, bold: true, align: start });
  y += logoSize + 6;
  put(data.title || T.title, left, y, { w: width, size: 10, color: C.grey, align: start });
  y += 18;
  hline(y);
  y += 12;

  // left (start side): order, placed, customer -- right (end side): delivery address
  const colW = width * 0.5 - 10;
  const addrW = 210;
  const startX = isAr ? right - colW : left;
  const addrX = isAr ? left : right - addrW;
  let ly = y;
  ly += put(`${T.order} ${data.orderId}`, startX, ly, { w: colW, size: 11, bold: true });
  ly += 2 + put(`${T.placed} ${data.placedAt}`, startX, ly + 2, { w: colW, size: 10, color: C.grey });
  ly += 12;
  ly += put(T.customer, startX, ly, { w: colW, size: 8.5, bold: true, color: C.grey });
  ly += 2 + put(data.customerName || T.guest, startX, ly + 2, { w: colW, size: 10 });
  let ry = y;
  if (data.address && data.address.length > 0) {
    ry += put(T.address, addrX, ry, { w: addrW, size: 8.5, bold: true, color: C.grey });
    ry += 2;
    for (const line of data.address.filter(Boolean)) ry += put(line, addrX, ry, { w: addrW, size: 10 }) + 1;
  }
  y = Math.max(ly, ry) + 18;

  // ---- items
  y = tableHeader(y);
  data.items.forEach((item) => {
    const nameH = put(item.name, 0, 0, { w: itemW - pad, size: 9.5, measureOnly: true });
    const rowH = Math.max(nameH, 11) + 12;
    if (y + rowH > contentBottom) {
      doc.addPage({ size: 'A4', margins: { top: M.top, bottom: M.bottom, left: M.side, right: M.side } });
      y = tableHeader(continuationHeader());
    }
    const ty = y + 6;
    put(item.name, colX.item + (isAr ? 0 : pad), ty, { w: itemW - pad, size: 9.5 });
    put(String(item.quantity), colX.qty, ty, { w: qtyW, size: 9.5, align: 'center' });
    put(money(item.unitUsd), colX.unit, ty, { w: unitW - (isAr ? 0 : pad), size: 9.5, align: end });
    put(money(item.unitUsd * item.quantity), colX.tot + (isAr ? pad : 0), ty, { w: totW - pad, size: 9.5, bold: true, align: end });
    y += rowH;
    hline(y);
  });

  // ---- totals
  const lines = [[T.subtotal, money(data.items.reduce((s, i) => s + i.unitUsd * i.quantity, 0))]];
  if (Number(data.discountUsd) > 0) lines.push([T.discount, `- ${money(data.discountUsd)}`]);
  if (Number(data.shippingUsd) > 0) lines.push([T.shipping, `+ ${money(data.shippingUsd)}`]);
  const totalsH = 16 + lines.length * 16 + 34;
  if (y + totalsH > contentBottom) {
    doc.addPage({ size: 'A4', margins: { top: M.top, bottom: M.bottom, left: M.side, right: M.side } });
    y = continuationHeader();
  }
  y += 16;
  const boxW = 240;
  const boxX = isAr ? left : right - boxW;
  // label on the start side, value on the end side (Arabic: label on the right, value on the left)
  const halfLabelX = isAr ? boxX + boxW / 2 : boxX;
  const halfValueX = isAr ? boxX : boxX + boxW / 2;
  for (const [label, value] of lines) {
    put(label, halfLabelX, y, { w: boxW / 2, size: 10, align: start });
    put(value, halfValueX, y, { w: boxW / 2, size: 10, align: end });
    y += 16;
  }
  y += 4;
  doc.roundedRect(boxX, y, boxW, 30, 6).lineWidth(1.5).strokeColor(C.ink).stroke();
  const labelX = isAr ? boxX + boxW / 2 : boxX + 10;
  const valueX = isAr ? boxX + 10 : boxX + boxW / 2;
  put(T.grand, labelX, y + 8, { w: boxW / 2 - 10, size: 12, bold: true, align: start });
  put(money(data.totalUsd), valueX, y + 8, { w: boxW / 2 - 10, size: 12, bold: true, align: end });

  // ---- footer on every page: the admin's note and "Page x of y"
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const saved = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;                          // writing in the bottom margin must not start a new page
    const fy = H - M.bottom + 4;
    const pageText = T.page(i - range.start + 1, range.count);
    put(pageText, isAr ? left : right - 150, fy, { w: 150, size: 8, color: C.light, align: end });
    if (data.footerNote) put(data.footerNote, isAr ? left + 160 : left, fy, { w: width - 170, size: 8, color: C.light, align: start });
    doc.page.margins.bottom = saved;
  }
  doc.end();
}

module.exports = { drawReceipt, receiptCurrency, moneyFormatter, TEXT };
