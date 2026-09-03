import * as XLSX from "xlsx";

/** Builds a single worksheet deliberately suitable for email attachment. */
export function fleetActivityWorkbook(rows: Array<Record<string, unknown>>): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = Object.keys(rows[0] ?? {}).map(key => ({ wch: Math.min(48, Math.max(12, key.length + 2)) }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Fleet Activity");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
}