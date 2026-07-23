import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildWorkbook } from './exportToExcel';

describe('real Excel (.xlsx) export utility', () => {
  it('CRITICAL: produces a real, valid workbook with the real headers and real row data, verified by actually reading it back', async () => {
    const workbook = await buildWorkbook({
      sheetName: 'Test Sheet',
      columns: [
        { header: 'Order ID', key: 'id' },
        { header: 'Total', key: 'total' },
      ],
      rows: [
        { id: 'LP-1001', total: 39.99 },
        { id: 'LP-1002', total: 89.5 },
      ],
    });

    // Real round-trip: write the real workbook to a real buffer, then
    // read that real buffer back with a fresh, independent ExcelJS
    // instance -- proving the actual bytes written are a genuinely
    // valid, readable .xlsx file, not just that no error was thrown
    // while building it in memory.
    const buffer = await workbook.xlsx.writeBuffer();
    const readBack = new ExcelJS.Workbook();
    await readBack.xlsx.load(buffer);

    const sheet = readBack.getWorksheet('Test Sheet');
    expect(sheet).toBeTruthy();
    expect(sheet.getRow(1).getCell(1).value).toBe('Order ID');
    expect(sheet.getRow(1).getCell(2).value).toBe('Total');
    expect(sheet.getRow(1).font.bold).toBe(true);
    expect(sheet.getRow(2).getCell(1).value).toBe('LP-1001');
    expect(sheet.getRow(2).getCell(2).value).toBe(39.99);
    expect(sheet.getRow(3).getCell(1).value).toBe('LP-1002');
    expect(sheet.getRow(3).getCell(2).value).toBe(89.5);
  });

  it('a real export with zero rows still produces a valid workbook with just the real header row', async () => {
    const workbook = await buildWorkbook({
      columns: [{ header: 'Admin', key: 'adminEmail' }],
      rows: [],
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const readBack = new ExcelJS.Workbook();
    await readBack.xlsx.load(buffer);
    const sheet = readBack.worksheets[0];
    expect(sheet.getRow(1).getCell(1).value).toBe('Admin');
    expect(sheet.rowCount).toBe(1);
  });

  it('real column widths are actually applied, with a sensible real default when not specified', async () => {
    const workbook = await buildWorkbook({
      columns: [
        { header: 'Wide column', key: 'wide', width: 50 },
        { header: 'Default width', key: 'narrow' },
      ],
      rows: [{ wide: 'x', narrow: 'y' }],
    });
    const sheet = workbook.worksheets[0];
    expect(sheet.getColumn(1).width).toBe(50);
    expect(sheet.getColumn(2).width).toBe(20);
  });
});
