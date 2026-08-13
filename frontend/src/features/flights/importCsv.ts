/**
 * Parse a flight-history CSV into journeys.
 *
 * Runs in the browser so the result can be previewed and corrected before
 * anything is written. Importing a few hundred flights on a blind upload is
 * not an action anyone can undo.
 *
 * Deliberately tolerant about shape: people export from Flighty, App in the
 * Air, a spreadsheet they keep themselves, or an airline's history page, and
 * none of them agree on column names. Columns are matched by meaning rather
 * than by position or exact header.
 */

export interface ParsedLeg {
  from: string;
  to: string;
}

export interface ParsedJourney {
  date?: string;
  legs: ParsedLeg[];
  notes?: string;
  /** Source rows, so the preview can point at the offending line. */
  rows: number[];
}

export interface ParseResult {
  journeys: ParsedJourney[];
  errors: { row: number; reason: string; raw: string }[];
  /** Which header each field was matched to, shown so the guess is auditable. */
  mapping: Record<string, string | null>;
  totalRows: number;
}

const FIELD_ALIASES: Record<string, string[]> = {
  from: ['from', 'origin', 'departure', 'dep', 'departureairport', 'originairport', 'fromairport', 'depairport'],
  to: ['to', 'destination', 'arrival', 'arr', 'arrivalairport', 'destinationairport', 'toairport', 'arrairport'],
  date: ['date', 'departuredate', 'depdate', 'flightdate', 'localdepartured', 'departed'],
  notes: ['notes', 'note', 'comment', 'comments', 'airline', 'flight'],
};

const normalise = (value: string) =>
  value.toLowerCase().replace(/[^a-z]/g, '');

/** Split one CSV line, honouring quoted fields containing the delimiter. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      // A doubled quote inside a quoted field is a literal quote.
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      out.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  out.push(current.trim());
  return out;
}

function detectDelimiter(headerLine: string): string {
  // Semicolons are common in locales where the comma is a decimal separator.
  const counts = [',', ';', '\t'].map((d) => ({
    d,
    n: headerLine.split(d).length,
  }));
  return counts.sort((a, b) => b.n - a.n)[0].d;
}

/**
 * Pull an IATA code out of a cell.
 *
 * Handles "SOF", "Sofia (SOF)" and "SOF - Sofia". A parenthesised code wins,
 * since in "Sofia (SOF)" the bare-token rule would otherwise have to guess.
 */
export function extractIata(value: string): string | null {
  if (!value) return null;
  const parenthesised = value.match(/\(([A-Za-z]{3})\)/);
  if (parenthesised) return parenthesised[1].toUpperCase();

  const token = value.trim().match(/^([A-Za-z]{3})\b/);
  if (token) return token[1].toUpperCase();

  const anywhere = value.match(/\b([A-Z]{3})\b/);
  return anywhere ? anywhere[1].toUpperCase() : null;
}

/**
 * Normalise a date to YYYY-MM-DD.
 *
 * Ambiguous D/M/Y vs M/D/Y is resolved in favour of D/M/Y, which is what most
 * of the world exports; a value that can only be M/D/Y (month > 12 in the
 * first position) is read that way instead. Anything unrecognisable returns
 * undefined and the flight is imported undated rather than dropped.
 */
export function parseDate(value: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slashed = trimmed.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/);
  if (slashed) {
    const [, a, b, y] = slashed;
    let day = Number(a);
    let month = Number(b);
    if (day > 12 && month <= 12) {
      // unambiguous D/M
    } else if (month > 12 && day <= 12) {
      [day, month] = [month, day];
    }
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return undefined;
}

export function parseFlightsCsv(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  const result: ParseResult = {
    journeys: [],
    errors: [],
    mapping: { from: null, to: null, date: null, notes: null },
    totalRows: 0,
  };

  if (lines.length < 2) {
    result.errors.push({ row: 0, reason: 'File is empty or has no data rows', raw: '' });
    return result;
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter);
  const normalisedHeaders = headers.map(normalise);

  const indexOf = (field: string): number => {
    const aliases = FIELD_ALIASES[field];
    // Exact alias first, so "from" is not beaten by "fromairportcity".
    for (const alias of aliases) {
      const exact = normalisedHeaders.indexOf(alias);
      if (exact !== -1) return exact;
    }
    return normalisedHeaders.findIndex((h) =>
      aliases.some((alias) => h.startsWith(alias))
    );
  };

  const fromIdx = indexOf('from');
  const toIdx = indexOf('to');
  const dateIdx = indexOf('date');
  const notesIdx = indexOf('notes');

  result.mapping = {
    from: fromIdx === -1 ? null : headers[fromIdx],
    to: toIdx === -1 ? null : headers[toIdx],
    date: dateIdx === -1 ? null : headers[dateIdx],
    notes: notesIdx === -1 ? null : headers[notesIdx],
  };

  if (fromIdx === -1 || toIdx === -1) {
    result.errors.push({
      row: 1,
      reason:
        'Could not find origin and destination columns. Expected headers like "From" and "To".',
      raw: lines[0],
    });
    return result;
  }

  const flat: (ParsedJourney & { date?: string })[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1;
    const cells = splitLine(lines[i], delimiter);
    result.totalRows++;

    const from = extractIata(cells[fromIdx] ?? '');
    const to = extractIata(cells[toIdx] ?? '');

    if (!from || !to) {
      result.errors.push({
        row: rowNumber,
        reason: !from && !to ? 'No airport codes found' : `Missing ${!from ? 'origin' : 'destination'} code`,
        raw: lines[i].slice(0, 80),
      });
      continue;
    }
    if (from === to) {
      result.errors.push({
        row: rowNumber,
        reason: `Origin and destination are both ${from}`,
        raw: lines[i].slice(0, 80),
      });
      continue;
    }

    flat.push({
      date: dateIdx === -1 ? undefined : parseDate(cells[dateIdx] ?? ''),
      legs: [{ from, to }],
      notes: notesIdx === -1 ? undefined : cells[notesIdx]?.slice(0, 200) || undefined,
      rows: [rowNumber],
    });
  }

  /*
    Merge consecutive rows into one journey when they connect: same date, and
    this row departs from where the last one arrived. That turns a Flighty
    export of SOF→AMS, AMS→NRT on one day into the single journey the app
    models, instead of two unrelated hops. Conservative on purpose — anything
    that does not chain stays separate.
  */
  for (const entry of flat) {
    const previous = result.journeys[result.journeys.length - 1];
    const connects =
      previous &&
      previous.date === entry.date &&
      entry.date !== undefined &&
      previous.legs[previous.legs.length - 1].to === entry.legs[0].from;

    if (connects) {
      previous.legs.push(entry.legs[0]);
      previous.rows.push(...entry.rows);
      if (!previous.notes && entry.notes) previous.notes = entry.notes;
    } else {
      result.journeys.push(entry);
    }
  }

  return result;
}
