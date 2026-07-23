import ExcelJS from "exceljs";

/**
 * Real .xlsx export utility (confirmed scope: real Excel format, not
 * CSV) -- shared across every admin page that offers an export
 * (audit log, orders, payouts). Client-side generation directly from
 * whatever real data the page already has loaded -- no new backend
 * endpoint needed, since this is just a different real representation
 * of data the admin can already see on screen.
 *
 * columns: [{ header: string, key: string, width?: number }]
 * rows: array of plain objects, keyed to match each column's `key`.
 *
 * Split into two real functions deliberately: buildWorkbook() is pure
 * and testable (no browser APIs), while exportToExcel() adds the real
 * browser-only download trigger on top -- letting a real test verify
 * the actual real workbook contents without needing to fake
 * URL.createObjectURL or a real file-save dialog.
 */
export async function buildWorkbook({ columns, rows, sheetName = "Sheet1" }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 20 }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));
  return workbook;
}

export async function exportToExcel({ columns, rows, sheetName = "Sheet1", filename }) {
  const workbook = await buildWorkbook({ columns, rows, sheetName });
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
