import * as XLSX from "xlsx";

type ExportSheet = {
  name: string;
  rows: Array<Record<string, unknown>>;
};

export function exportWorkbook(filename: string, sheets: ExportSheet[]) {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(sheet.name));
  }

  XLSX.writeFileXLSX(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

function safeSheetName(value: string) {
  return value.replace(/[\\/*?:[\]]/g, " ").slice(0, 31) || "Sheet1";
}
