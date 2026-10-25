/**
 * RFC 4180 CSV with two extras:
 *  - Formula-injection guard: cells starting with = + - @ (or tab/CR) get a leading apostrophe, so a name like
 *    "=HYPERLINK(...)" typed by anyone can't execute when a manager opens the export in Excel/Sheets.
 *  - UTF-8 BOM so Excel shows accented names correctly.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: { header: string; value: (row: T) => unknown }[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(",")];
  for (const r of rows) lines.push(columns.map((c) => csvCell(c.value(r))).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
