/**
 * Reads CSV text (as exported by Excel or Google Sheets): quoted fields, commas and line breaks inside quotes,
 * doubled quotes, Windows line endings and a leading byte-order mark. Returns the rows as arrays of text.
 */
export const parseCsv = (input: string): string[][] => {
  const text = input.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Blank lines at the end (or between rows) are not rows.
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
};

/** The rows as objects keyed by the header names (trimmed, lower case). */
export const parseCsvRecords = (input: string): Record<string, string>[] => {
  const [header, ...rows] = parseCsv(input);
  if (!header) return [];
  const keys = header.map((name) => name.trim().toLowerCase());
  return rows.map((cells) => Object.fromEntries(keys.map((key, index) => [key, (cells[index] ?? '').trim()])));
};
