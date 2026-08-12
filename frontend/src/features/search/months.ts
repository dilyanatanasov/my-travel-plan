export interface MonthOption {
  /** "YYYY-MM". */
  value: string;
  /** "September" — the year is appended only when it differs from today's. */
  label: string;
  shortLabel: string;
}

/** The next 12 months, starting from the current one. */
export function nextTwelveMonths(): MonthOption[] {
  const now = new Date();
  const options: MonthOption[] = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const sameYear = date.getFullYear() === now.getFullYear();
    options.push({
      value,
      label: date.toLocaleDateString(undefined, {
        month: 'long',
        ...(sameYear ? {} : { year: 'numeric' }),
      }),
      shortLabel: date.toLocaleDateString(undefined, {
        month: 'short',
        ...(sameYear ? {} : { year: '2-digit' }),
      }),
    });
  }
  return options;
}

/** Default focus: next month. Searching the current month mostly returns
 *  departures that have already left. */
export function defaultMonth(): string {
  return nextTwelveMonths()[1].value;
}
