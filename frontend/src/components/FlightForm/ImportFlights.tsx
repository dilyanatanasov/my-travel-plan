import { useRef, useState } from 'react';
import {
  parseFlightsCsv,
  type ParseResult,
} from '../../features/flights/importCsv';
import { useImportFlightsMutation } from '../../features/flights/flightsApi';
import { useToast } from '../Toast/ToastProvider';

/**
 * CSV import with a mandatory preview.
 *
 * Hand-entering a flight history is the single biggest barrier to using this
 * app at all — the reference account has 41 journeys entered one at a time.
 *
 * Nothing is written until the parse has been shown and confirmed. A blind
 * upload that creates two hundred journeys is not an action anyone can undo,
 * and the column matching is a guess by nature, so the guess is displayed.
 */
function ImportFlights() {
  const [result, setResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [importFlights, { isLoading }] = useImportFlightsMutation();
  const { showToast } = useToast();

  const reset = () => {
    setResult(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      setFileName(file.name);
      setResult(parseFlightsCsv(text));
    } catch {
      showToast('Could not read that file', { tone: 'error' });
    }
  };

  const handleConfirm = async () => {
    if (!result?.journeys.length) return;
    try {
      const response = await importFlights({
        journeys: result.journeys.map(({ date, legs, notes }) => ({
          date,
          legs,
          notes,
        })),
      }).unwrap();

      const parts = [`${response.imported} imported`];
      if (response.skipped) parts.push(`${response.skipped} already there`);
      if (response.failed.length) parts.push(`${response.failed.length} failed`);
      showToast(parts.join(' · '), {
        tone: response.imported > 0 ? 'success' : 'error',
        durationMs: 7000,
      });

      if (response.failed.length) {
        // Keep the panel open so the failures stay readable.
        setResult({
          ...result,
          journeys: [],
          errors: response.failed.map((f) => ({
            row: f.row,
            reason: f.reason,
            raw: f.route,
          })),
        });
      } else {
        reset();
        setIsOpen(false);
      }
    } catch {
      showToast('Import failed', { tone: 'error' });
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full min-h-11 px-3 rounded-lg border border-dashed border-line text-sm font-medium text-ink-muted hover:border-brand-500 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        Import flights from a file
      </button>
    );
  }

  const journeyCount = result?.journeys.length ?? 0;
  const legCount =
    result?.journeys.reduce((sum, j) => sum + j.legs.length, 0) ?? 0;

  return (
    <div className="border border-line rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-ink">Import flights</h3>
        <button
          type="button"
          onClick={() => {
            reset();
            setIsOpen(false);
          }}
          className="min-h-9 px-2 text-xs text-ink-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
        >
          Cancel
        </button>
      </div>

      {!result && (
        <>
          <p className="text-xs text-ink-muted">
            A CSV with origin, destination and date columns. Exports from
            Flighty, App in the Air or your own spreadsheet all work — columns
            are matched by name, not position.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            className="block w-full text-sm text-ink-muted file:mr-3 file:min-h-9 file:px-3 file:rounded-lg file:border-0 file:bg-brand-600 file:text-white file:text-sm file:font-medium hover:file:bg-brand-700"
          />
        </>
      )}

      {result && (
        <div className="space-y-3">
          <p className="text-xs text-ink-muted truncate">{fileName}</p>

          {/* The column guess, shown so a wrong match is caught before import
              rather than after 200 bad rows. */}
          <dl className="text-xs grid grid-cols-2 gap-x-3 gap-y-1">
            {Object.entries(result.mapping).map(([field, header]) => (
              <div key={field} className="flex justify-between gap-2">
                <dt className="text-ink-subtle capitalize">{field}</dt>
                <dd className={header ? 'text-ink' : 'text-ink-subtle italic'}>
                  {header ?? 'not found'}
                </dd>
              </div>
            ))}
          </dl>

          {journeyCount > 0 && (
            <>
              <p className="text-sm text-ink">
                <span className="font-semibold">{journeyCount}</span> journeys
                {legCount !== journeyCount && ` (${legCount} flights)`} ready to
                import
              </p>
              <ul className="max-h-40 overflow-y-auto scrollbar-thin border border-line rounded-lg divide-y divide-line text-xs">
                {result.journeys.slice(0, 50).map((journey, i) => (
                  <li key={i} className="px-2 py-1.5 flex justify-between gap-2">
                    <span className="font-mono text-ink truncate">
                      {[journey.legs[0].from, ...journey.legs.map((l) => l.to)].join(' → ')}
                    </span>
                    <span className="text-ink-subtle flex-shrink-0">
                      {journey.date ?? 'no date'}
                    </span>
                  </li>
                ))}
              </ul>
              {journeyCount > 50 && (
                <p className="text-xs text-ink-subtle">
                  Showing the first 50 of {journeyCount}.
                </p>
              )}
            </>
          )}

          {result.errors.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-danger min-h-9 flex items-center">
                {result.errors.length} row
                {result.errors.length === 1 ? '' : 's'} skipped
              </summary>
              <ul className="mt-1 space-y-1 max-h-32 overflow-y-auto scrollbar-thin">
                {result.errors.slice(0, 30).map((error, i) => (
                  <li key={i} className="text-ink-muted">
                    <span className="text-ink-subtle">Row {error.row}:</span>{' '}
                    {error.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading || journeyCount === 0}
              className="flex-1 min-h-11 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {isLoading
                ? 'Importing…'
                : journeyCount > 0
                  ? `Import ${journeyCount}`
                  : 'Nothing to import'}
            </button>
            <button
              type="button"
              onClick={reset}
              className="min-h-11 px-3 rounded-lg border border-line text-sm text-ink-muted hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              Choose another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportFlights;
