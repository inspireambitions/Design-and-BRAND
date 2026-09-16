import type { StudentRosterRow, RosterParseResult } from './types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function detectDelimiter(headerLine: string): string {
  const commas = (headerLine.match(/,/g) || []).length;
  const semicolons = (headerLine.match(/;/g) || []).length;
  const tabs = (headerLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semicolons) return '\t';
  if (semicolons > commas) return ';';
  return ',';
}

function normalizeHeader(col: string): string {
  return col
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/[\s_-]+/g, '');
}

export function parseStudentRosterCsv(csvText: string): RosterParseResult {
  const cleanText = stripBom(csvText).trim();
  if (!cleanText) {
    return { total: 0, valid: [], duplicates: [], invalid: [] };
  }

  const lines = cleanText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) {
    return { total: 0, valid: [], duplicates: [], invalid: [] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map(normalizeHeader);

  let idIdx = -1;
  let nameIdx = -1;
  let emailIdx = -1;

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (['studentid', 'id', 'studentnumber', 'identifier', 'الرقمالجامعي', 'رقمالطالب', 'الرقم'].includes(h)) {
      idIdx = i;
    } else if (['name', 'fullname', 'studentname', 'student', 'الاسم', 'اسمالطالب', 'الاسمكامل'].includes(h)) {
      nameIdx = i;
    } else if (['email', 'emailaddress', 'universityemail', 'البريد', 'البريدالالكتروني'].includes(h)) {
      emailIdx = i;
    }
  }

  const hasValidHeaders = nameIdx !== -1 || (headers.length >= 2 && emailIdx !== -1);
  let startIndex = 1;

  if (!hasValidHeaders) {
    const firstCols = parseCsvLine(lines[0], delimiter);
    if (firstCols.some(c => EMAIL_REGEX.test(c))) {
      startIndex = 0;
      if (firstCols.length === 2) {
        nameIdx = 0;
        emailIdx = 1;
      } else {
        idIdx = 0;
        nameIdx = 1;
        emailIdx = 2;
      }
    } else {
      idIdx = 0;
      nameIdx = 1;
      emailIdx = 2;
      startIndex = 1;
    }
  } else {
    if (nameIdx === -1) {
      nameIdx = headers.findIndex((_, idx) => idx !== idIdx && idx !== emailIdx);
    }
  }

  const valid: StudentRosterRow[] = [];
  const duplicates: StudentRosterRow[] = [];
  const invalid: { line: number; raw: string; error: string }[] = [];

  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();

  for (let lineNum = startIndex; lineNum < lines.length; lineNum++) {
    const rawLine = lines[lineNum];
    const cols = parseCsvLine(rawLine, delimiter);

    const name = (nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx] : '').trim();
    const studentIdentifier = (idIdx !== -1 && cols[idIdx] ? cols[idIdx] : '').trim();
    const email = (emailIdx !== -1 && cols[emailIdx] ? cols[emailIdx] : '').trim();

    if (!name) {
      invalid.push({ line: lineNum + 1, raw: rawLine, error: 'Student name is required' });
      continue;
    }

    if (name.length < 2 || name.length > 100) {
      invalid.push({ line: lineNum + 1, raw: rawLine, error: 'Student name must be between 2 and 100 characters' });
      continue;
    }

    if (email && !EMAIL_REGEX.test(email)) {
      invalid.push({ line: lineNum + 1, raw: rawLine, error: `Invalid email address format: "${email}"` });
      continue;
    }

    const row: StudentRosterRow = {
      name,
      ...(studentIdentifier ? { studentIdentifier } : {}),
      ...(email ? { email: email.toLowerCase() } : {}),
    };

    const idKey = studentIdentifier ? studentIdentifier.toLowerCase() : null;
    const emailKey = email ? email.toLowerCase() : null;

    let isDuplicate = false;
    if (idKey && seenIds.has(idKey)) {
      isDuplicate = true;
    }
    if (emailKey && seenEmails.has(emailKey)) {
      isDuplicate = true;
    }

    if (isDuplicate) {
      duplicates.push(row);
    } else {
      if (idKey) seenIds.add(idKey);
      if (emailKey) seenEmails.add(emailKey);
      valid.push(row);
    }
  }

  return {
    total: lines.length - startIndex,
    valid,
    duplicates,
    invalid,
  };
}
