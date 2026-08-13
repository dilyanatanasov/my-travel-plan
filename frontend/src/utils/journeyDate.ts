import type { FlightJourney } from '../types';

type Dated = Pick<FlightJourney, 'journeyDate' | 'datePrecision'>;

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** The progressive form's three fields, prefilled at the stored precision. */
export function journeyDateParts(journey: Dated): {
  year: string;
  month: string;
  day: string;
} {
  if (!journey.journeyDate) return { year: '', month: '', day: '' };
  const date = new Date(journey.journeyDate);
  if (Number.isNaN(date.getTime())) return { year: '', month: '', day: '' };
  const precision = journey.datePrecision || 'day';
  return {
    year: String(date.getFullYear()),
    month:
      precision === 'year'
        ? ''
        : String(date.getMonth() + 1).padStart(2, '0'),
    day:
      precision === 'day' ? String(date.getDate()).padStart(2, '0') : '',
  };
}

/** Y/M/D fields → the DTO pair. Empty year clears the date entirely. */
export function buildDateDto(
  year: string,
  month: string,
  day: string,
): { journeyDate: string; datePrecision?: 'day' | 'month' | 'year' } {
  const y = year.trim();
  if (!y) return { journeyDate: '' };
  return {
    journeyDate: `${y.padStart(4, '0')}-${month || '01'}-${day || '01'}`,
    datePrecision: day ? 'day' : month ? 'month' : 'year',
  };
}

/**
 * Render a journey's date at the precision the user actually asserted:
 * "2016", "May 2019" or "5 Mar 2024". Anything else would print the stored
 * period-start day as if it were real.
 */
export function formatJourneyDate(
  journey: Dated,
  style: 'long' | 'short' = 'short',
): string | null {
  if (!journey.journeyDate) return null;
  const date = new Date(journey.journeyDate);
  if (Number.isNaN(date.getTime())) return null;

  const precision = journey.datePrecision || 'day';
  if (precision === 'year') return String(date.getFullYear());
  if (precision === 'month') {
    return date.toLocaleDateString(undefined, {
      month: style === 'long' ? 'long' : 'short',
      year: 'numeric',
    });
  }
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
  });
}
