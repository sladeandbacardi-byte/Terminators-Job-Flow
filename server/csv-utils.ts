function sanitizeSpreadsheetValue(value: unknown): string {
  const stringValue = String(value ?? "");
  if (typeof value === "string" && /^[\s\x00-\x1F]*[=+\-@]/.test(stringValue)) {
    return `'${stringValue}`;
  }
  return stringValue;
}

export function escapeCsvCell(value: unknown): string {
  const stringValue = sanitizeSpreadsheetValue(value);
  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function buildCsvRow(cells: readonly unknown[]): string {
  return cells.map(escapeCsvCell).join(",");
}

export function buildCsvFromRows(rows: readonly (readonly unknown[])[]): string {
  return rows.map(buildCsvRow).join("\n");
}

export function buildCsvFromObjectRows(rows: readonly Record<string, unknown>[]): string {
  const headers = Object.keys(rows[0] ?? {});
  return buildCsvFromRows([
    headers,
    ...rows.map(row => headers.map(header => row[header])),
  ]);
}