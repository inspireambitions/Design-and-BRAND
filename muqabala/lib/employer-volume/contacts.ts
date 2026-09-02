/**
 * Contact parsing for the Add candidates screen. Pure and isomorphic so the
 * browser can show the summary line before anything is sent and the server can
 * validate the same input again.
 *
 * Accepts free text with any separator and CSV exports from applicant systems.
 * Columns are detected by header name, case-insensitive. No mapping screen.
 */

export type Contact = {
  email: string | null;
  phone: string | null;
  name: string | null;
};

export type InvalidRow = {
  /** Zero-based position in the input, for the inline fix field. */
  index: number;
  raw: string;
  reason: 'no_contact' | 'bad_email' | 'bad_phone';
};

export type ParseResult = {
  /** Every non-empty row seen before duplicate and invalid handling. */
  found: number;
  duplicates: number;
  invalid: InvalidRow[];
  valid: Contact[];
};

export const MAX_CONTACTS = 1000;

const EMAIL = /^[^\s@,;<>()[\]"']+@[^\s@,;<>()[\]"']+\.[a-z]{2,}$/i;

const EMAIL_HEADERS = ['email', 'e-mail', 'email address', 'e-mail address', 'candidate email', 'work email', 'primary email'];
const PHONE_HEADERS = ['phone', 'mobile', 'phone number', 'mobile number', 'primary phone', 'telephone', 'cell', 'contact number'];
const NAME_HEADERS = ['name', 'full name', 'candidate', 'candidate name'];
const FIRST_HEADERS = ['first name', 'firstname', 'given name'];
const LAST_HEADERS = ['last name', 'lastname', 'surname', 'family name'];

export function normaliseEmail(value: string): string | null {
  const trimmed = value.trim().replace(/^mailto:/i, '').toLowerCase();
  return EMAIL.test(trimmed) && trimmed.length <= 254 ? trimmed : null;
}

/**
 * Returns E.164 or null. Accepts +, 00 and bare international numbers with
 * spaces, dashes and brackets. Local numbers with no country code are invalid
 * because the country cannot be inferred safely.
 */
export function normalisePhone(value: string): string | null {
  let digits = value.trim().replace(/[\s().-]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith('+')) {
    if (/^[1-9][0-9]{9,14}$/.test(digits)) digits = `+${digits}`;
    else return null;
  }
  return /^\+[1-9][0-9]{7,14}$/.test(digits) ? digits : null;
}

function looksLikePhone(token: string): boolean {
  return /^[+0-9][0-9\s().-]{6,}$/.test(token.trim());
}

function cleanName(value: string | undefined | null): string | null {
  const name = (value ?? '').replace(/\s+/g, ' ').trim();
  return name.length >= 1 && name.length <= 100 ? name : null;
}

type RawRow = { raw: string; email?: string; phone?: string; name?: string };

/**
 * Split pasted text on newline, comma, semicolon, space or tab. A segment that
 * reads as one phone number with internal spaces ("+971 50 123 4567") stays
 * whole; everything else also splits on spaces.
 */
export function parseFreeText(text: string): RawRow[] {
  const tokens: string[] = [];
  for (const segment of text.split(/[\n\r,;\t]+/)) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    if (looksLikePhone(trimmed) && !trimmed.includes('@')) tokens.push(trimmed);
    else tokens.push(...trimmed.split(/ +/).filter(Boolean));
  }
  return tokens.map((token) => {
    if (token.includes('@')) return { raw: token, email: token };
    if (looksLikePhone(token)) return { raw: token, phone: token };
    return { raw: token };
  });
}

/** RFC 4180 style CSV split, handling quoted fields with embedded commas and quotes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(field); field = ''; }
    else field += ch;
  }
  out.push(field);
  return out.map((value) => value.trim());
}

function findColumn(headers: string[], candidates: string[], exclude: number[] = []): number {
  const lowered = headers.map((header) => header.toLowerCase().replace(/[_*]/g, ' ').replace(/\s+/g, ' ').trim());
  for (const candidate of candidates) {
    const exact = lowered.findIndex((header, index) => header === candidate && !exclude.includes(index));
    if (exact >= 0) return exact;
  }
  for (const candidate of candidates) {
    const partial = lowered.findIndex((header, index) => header.includes(candidate) && !exclude.includes(index));
    if (partial >= 0) return partial;
  }
  return -1;
}

/** Parse a CSV export. Detects email, phone and name columns from the header row. */
export function parseCsv(text: string): RawRow[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]);
  const emailCol = findColumn(headers, EMAIL_HEADERS);
  const phoneCol = findColumn(headers, PHONE_HEADERS);
  const firstCol = findColumn(headers, FIRST_HEADERS);
  const lastCol = findColumn(headers, LAST_HEADERS);
  // "First Name" and "Last Name" must not be mistaken for a full name column.
  const nameCol = findColumn(headers, NAME_HEADERS, [firstCol, lastCol, emailCol, phoneCol].filter((index) => index >= 0));
  if (emailCol < 0 && phoneCol < 0) {
    // No recognised header: treat the whole file as free text.
    return parseFreeText(text);
  }
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const first = firstCol >= 0 ? cells[firstCol] : '';
    const last = lastCol >= 0 ? cells[lastCol] : '';
    const combined = [first, last].filter(Boolean).join(' ');
    return {
      raw: line,
      email: emailCol >= 0 ? cells[emailCol] : undefined,
      phone: phoneCol >= 0 ? cells[phoneCol] : undefined,
      name: nameCol >= 0 && cells[nameCol] ? cells[nameCol] : combined || undefined,
    };
  });
}

/** Validate, deduplicate and summarise. Duplicates are matched on lower-cased email or E.164 phone. */
export function resolveContacts(rows: RawRow[]): ParseResult {
  const valid: Contact[] = [];
  const invalid: InvalidRow[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  rows.forEach((row, index) => {
    const email = row.email ? normaliseEmail(row.email) : null;
    const phone = row.phone ? normalisePhone(row.phone) : null;
    if (row.email && !email && !phone) { invalid.push({ index, raw: row.raw, reason: 'bad_email' }); return; }
    if (row.phone && !phone && !email) { invalid.push({ index, raw: row.raw, reason: 'bad_phone' }); return; }
    if (!email && !phone) { invalid.push({ index, raw: row.raw, reason: 'no_contact' }); return; }

    const keys = [email ? `e:${email}` : null, phone ? `p:${phone}` : null].filter((key): key is string => Boolean(key));
    if (keys.some((key) => seen.has(key))) { duplicates += 1; return; }
    for (const key of keys) seen.add(key);
    valid.push({ email, phone, name: cleanName(row.name) });
  });

  return { found: rows.length, duplicates, invalid, valid };
}

export function parseContacts(input: string, kind: 'text' | 'csv'): ParseResult {
  const rows = kind === 'csv' ? parseCsv(input) : parseFreeText(input);
  return resolveContacts(rows.slice(0, MAX_CONTACTS * 2));
}

/** "223 found. 4 duplicates removed. 2 invalid." */
export function summaryLine(result: ParseResult, lang: 'en' | 'ar' = 'en'): string {
  const n = (value: number) => new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-GB').format(value);
  if (lang === 'ar') {
    return `تم العثور على ${n(result.found)}. أُزيل ${n(result.duplicates)} مكرراً. ${n(result.invalid.length)} غير صالح.`;
  }
  return `${n(result.found)} found. ${n(result.duplicates)} duplicates removed. ${n(result.invalid.length)} invalid.`;
}
