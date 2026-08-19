import { useState } from 'react';
import type { FlightJourney, TravelMode } from '../../types';
import AirportSearch from '../AirportSearch';
import CitySearch from '../CitySearch/CitySearch';
import {
  formatJourneyDate,
  journeyDateParts,
  buildDateDto,
  MONTH_NAMES,
} from '../../utils/journeyDate';
import { useUpdateFlightMutation } from '../../features/flights/flightsApi';
import { useToast } from '../../components/Toast/ToastProvider';
import {
  type EditableStop,
  emptyStop,
  journeyToStops,
  moveStopWithModes,
  stopFilled,
  stopIdentity,
  stopLoopStatus,
  syncStopsWithMode,
  resolveFlightEndpoints,
  ferryCoastWarnings,
  hopRouteDistancesKm,
  HOP_MODES,
  MODE_LABEL,
} from './stopChain';
import { useAirportForCity } from '../FlightForm/useAirportForCity';
import { journeyRouteLabel, legEndpoints, legMode } from '../FlightMap/routeUtils';
import ModeIcon, { CityIcon } from '../ui/ModeIcon';
import StopPhotoControl from '../../features/flights/StopPhotoControl';

interface FlightCardProps {
  journey: FlightJourney;
  onDelete: (id: number) => void;
  /**
   * Reorder arrows (2026-08-14): present only when the neighbouring swap is
   * legal - same-date neighbour for dated journeys, any neighbour for
   * undated ones. An absent arrow is the constraint made visible.
   */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isReordering?: boolean;
  /** Opens the trip boarding-pass dialog (trip share, 2026-08-14). */
  onShare?: () => void;
}

function FlightCard({
  journey,
  onDelete,
  onMoveUp,
  onMoveDown,
  isReordering = false,
  onShare,
}: FlightCardProps) {
  /*
    Inline editing for what the backend can change on an existing journey:
    date (at any precision), notes, the round-trip label. The route itself
    stays delete-and-re-add - leg editing is a different feature. Split-off
    return journeys land here with no date, so this is where they get one.
  */
  const [isEditing, setIsEditing] = useState(false);
  /** Mobile ⋯ menu: share/edit/delete collapse below sm (2026-08-14). */
  const [menuOpen, setMenuOpen] = useState(false);
  /** Opens upward when the trigger sits near the viewport's bottom. */
  const [menuUp, setMenuUp] = useState(false);
  const [updateFlight, { isLoading: isSaving }] = useUpdateFlightMutation();
  const { showToast } = useToast();
  const initialParts = journeyDateParts(journey);
  const [editYear, setEditYear] = useState(initialParts.year);
  const [editMonth, setEditMonth] = useState(initialParts.month);
  const [editDay, setEditDay] = useState(initialParts.day);
  const [editNotes, setEditNotes] = useState(journey.notes ?? '');
  const [editRoundTrip, setEditRoundTrip] = useState(journey.isRoundTrip);

  /*
    The journey as an editable chain: stops (airports or cities) plus a
    mode per hop - the same model the add form builds with, so a mixed
    journey round-trips through edit without losing its land legs.
  */
  const [editStops, setEditStops] = useState<EditableStop[]>(
    () => journeyToStops(journey).stops,
  );
  const [editModes, setEditModes] = useState<TravelMode[]>(
    () => journeyToStops(journey).modes,
  );
  /** Set when the honesty rule unchecked Round trip, so the form says why. */
  const [roundTripAutoCleared, setRoundTripAutoCleared] = useState(false);

  /*
    Every stop mutation (reorder, retype, remove) flows through here so the
    Round trip label stays honest (2026-08-14): a chain that provably no
    longer ends where it started is not a round trip, and the checkbox
    unchecks itself - visibly, with the reason shown - rather than shipping
    a label that lies. It never re-checks itself: "round trip" is the
    user's claim to make.
  */
  const applyStops = (next: EditableStop[]) => {
    setEditStops(next);
    if (editRoundTrip && stopLoopStatus(next) === 'broken') {
      setEditRoundTrip(false);
      setRoundTripAutoCleared(true);
    }
  };

  const patchStop = (index: number, patch: Partial<EditableStop>) => {
    applyStops(
      editStops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)),
    );
  };

  const addStop = () => {
    applyStops([...editStops, emptyStop()]);
    // The new hop inherits the previous one's mode - drove out, likely
    // driving on; all-flight chains still beget flights.
    setEditModes((current) => [
      ...current,
      current[current.length - 1] ?? 'flight',
    ]);
  };

  /* Arrows move the stop AND its arrival mode - "Annecy by car" travels
     with Annecy instead of sticking to the row (owner report). */
  const moveEditStop = (index: number, direction: -1 | 1) => {
    const moved = moveStopWithModes(editStops, editModes, index, direction);
    applyStops(moved.stops);
    setEditModes(moved.modes);
  };

  const resolveAirport = useAirportForCity();

  // Same rule as the add form: the mode teaches its endpoints - land
  // flips empty stops to city search, flight resolves a chosen city to
  // its own airport when one exists.
  const changeEditMode = async (index: number, mode: TravelMode) => {
    setEditModes((current) => current.map((m, i) => (i === index ? mode : m)));
    const { stops: synced, conversions } = await syncStopsWithMode(
      editStops,
      index,
      mode,
      resolveAirport,
    );
    applyStops(synced);
    if (conversions.length > 0) {
      showToast(
        `Picked the airport for the flight: ${conversions.join(', ')}`,
        { key: 'stop-kind-sync' },
      );
    }
  };

  const removeStop = (index: number) => {
    if (editStops.length <= 2) return;
    applyStops(editStops.filter((_, i) => i !== index));
    // Removing stop i removes the hop before it (or the first hop for
    // i=0), keeping modes exactly one shorter than stops.
    const modeIndex = Math.max(index - 1, 0);
    setEditModes((current) => current.filter((_, i) => i !== modeIndex));
  };

  const startEdit = () => {
    const parts = journeyDateParts(journey);
    setEditYear(parts.year);
    setEditMonth(parts.month);
    setEditDay(parts.day);
    setEditNotes(journey.notes ?? '');
    setEditRoundTrip(journey.isRoundTrip);
    const chain = journeyToStops(journey);
    setEditStops(chain.stops);
    setEditModes(chain.modes);
    setRoundTripAutoCleared(false);
    setIsEditing(true);
  };

  // A plane cannot land in a city centre: flight hops need airports.
  const flightHopViolation = editModes.some(
    (mode, i) =>
      mode === 'flight' &&
      (editStops[i]?.kind !== 'airport' || editStops[i + 1]?.kind !== 'airport'),
  );

  const saveEdit = async () => {
    if (!editStops.every(stopFilled) || editStops.length < 2) {
      showToast('Every stop needs an airport or a city', { tone: 'error' });
      return;
    }
    // Same submit-time sweep as the add form: flight hops resolve their
    // city endpoints to airports, and an airportless city's hop becomes
    // the drive it obviously was (the Annecy rule).
    let chainStops = editStops;
    let chainModes = editModes;
    if (flightHopViolation) {
      const resolved = await resolveFlightEndpoints(
        editStops,
        editModes,
        resolveAirport,
      );
      if (!resolved.ok) {
        showToast(
          'A flight needs airports at both ends - pick the nearest airport or change that hop to train, car or bus',
          { tone: 'error' },
        );
        return;
      }
      chainStops = resolved.stops;
      chainModes = resolved.modes;
      applyStops(chainStops);
      setEditModes(chainModes);
      if (resolved.conversions.length > 0) {
        showToast(`Adjusted for you: ${resolved.conversions.join(', ')}`, {
          key: 'stop-kind-sync',
        });
      }
    }
    // The coastal heads-up, same rule as the add form: warn, never block.
    const coastWarnings = await ferryCoastWarnings(chainStops, chainModes);
    if (coastWarnings.length > 0) {
      showToast(
        `Heads up: ${coastWarnings.join(', ')} looks far from open water for a ferry - saving anyway`,
        { key: 'ferry-coast' },
      );
    }
    const original = journeyToStops(journey);
    const identity = (stops: EditableStop[], modes: TravelMode[]) =>
      stops.map(stopIdentity).join('>') + '|' + modes.join(',');
    const routeChanged =
      identity(chainStops, chainModes) !==
      identity(original.stops, original.modes);
    // The legacy shape keeps the server's ground-transfer typo guard.
    const allFlightAirports =
      chainModes.every((mode) => mode === 'flight') &&
      chainStops.every((stop) => stop.kind === 'airport');
    const routePayload = routeChanged
      ? allFlightAirports
        ? { airportIds: chainStops.map((stop) => stop.airport!.id) }
        : {
            stops: chainStops.map((stop) =>
              stop.kind === 'airport'
                ? { airportId: stop.airport!.id }
                : { cityId: stop.city!.id },
            ),
            modes: chainModes,
            // Honest surface km per hop; 0 keeps the server's haversine.
            routeDistancesKm: await hopRouteDistancesKm(
              chainStops,
              chainModes,
            ),
          }
      : {};
    try {
      await updateFlight({
        id: journey.id,
        data: {
          ...buildDateDto(editYear, editMonth, editDay),
          notes: editNotes.trim(),
          isRoundTrip: editRoundTrip,
          // Only when actually changed: a rebuild resets leg rows for nothing
          // otherwise.
          ...routePayload,
        },
      }).unwrap();
      setIsEditing(false);
    } catch (error) {
      const message =
        (error as { data?: { message?: string } })?.data?.message ??
        'Could not save the changes';
      showToast(message, { tone: 'error' });
    }
  };
  const routeString = journeyRouteLabel(journey);

  const totalDistance = journey.legs.reduce(
    (sum, leg) => sum + (Number(leg.distanceKm) || 0),
    0
  );

  // Precision-aware: shows "2016" or "May 2019" instead of pretending the
  // stored period-start day is a real memory.
  const formatDate = () => formatJourneyDate(journey) ?? 'No date';

  return (
    <div className="bg-surface border border-line rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {/* A seven-leg route is long. Smaller and tighter on mobile so it
                wraps to two readable lines rather than sprawling. */}
            <span className="font-mono text-sm sm:text-lg font-semibold text-ink leading-snug break-words">
              {routeString}
            </span>
            {journey.isRoundTrip && (
              <span className="px-2 py-0.5 text-xs bg-brand-100 text-brand-700 rounded-full whitespace-nowrap flex-shrink-0">
                Round trip
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-ink-muted">
            <span>{formatDate()}</span>
            <span>{Math.round(totalDistance).toLocaleString()} km</span>
            <span>
              {journey.legs.length} {journey.legs.length === 1 ? 'leg' : 'legs'}
            </span>
          </div>
          {journey.notes && !isEditing && (
            <p className="mt-2 text-sm text-ink-muted">{journey.notes}</p>
          )}
        </div>
        {(onMoveUp || onMoveDown) && (
          <div className="flex flex-col justify-center mr-0.5">
            {onMoveUp && (
              <button
                onClick={onMoveUp}
                disabled={isReordering}
                aria-label="Move earlier in the order"
                title="Move earlier"
                className="p-1 text-ink-subtle hover:text-brand-700 hover:bg-brand-50 rounded transition-colors disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            )}
            {onMoveDown && (
              <button
                onClick={onMoveDown}
                disabled={isReordering}
                aria-label="Move later in the order"
                title="Move later"
                className="p-1 text-ink-subtle hover:text-brand-700 hover:bg-brand-50 rounded transition-colors disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>
        )}
        {/*
          Below sm the three actions collapse into one ⋯ menu: four inline
          controls left the route ~240px on a phone (user report,
          2026-08-14). The reorder arrows stay inline - "tap and watch the
          card move" dies inside a menu.
        */}
        <div className="relative sm:hidden">
          <button
            onClick={(event) => {
              // Open upward when the card sits near the fold, so no option
              // hides below the scroll (owner report, 2026-08-18).
              const rect = event.currentTarget.getBoundingClientRect();
              setMenuUp(window.innerHeight - rect.bottom < 190);
              setMenuOpen((open) => !open);
            }}
            aria-label="More actions"
            aria-expanded={menuOpen}
            className="p-2 text-ink-subtle hover:text-ink hover:bg-surface-sunken rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
          {menuOpen && (
            <>
              {/* Invisible backdrop: any outside tap closes the menu. */}
              <button
                type="button"
                aria-hidden="true"
                tabIndex={-1}
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div
                className={`absolute right-0 z-20 min-w-36 bg-surface border border-line rounded-lg shadow-lg py-1 ${
                  menuUp ? 'bottom-10' : 'top-10'
                }`}
              >
                {onShare && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onShare();
                    }}
                    className="w-full text-left px-4 min-h-11 text-sm text-ink hover:bg-surface-sunken"
                  >
                    Share trip
                  </button>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    startEdit();
                  }}
                  className="w-full text-left px-4 min-h-11 text-sm text-ink hover:bg-surface-sunken"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(journey.id);
                  }}
                  className="w-full text-left px-4 min-h-11 text-sm text-danger hover:bg-danger-soft"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>

        {onShare && (
          <button
            onClick={onShare}
            aria-label="Share this trip"
            title="Share this trip"
            className="hidden sm:block p-2 text-ink-subtle hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342a3 3 0 100-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684zm0-9.316a3 3 0 105.368-2.684 3 3 0 00-5.368 2.684z"
              />
            </svg>
          </button>
        )}
        <button
          onClick={startEdit}
          aria-label="Edit this journey"
          className="hidden sm:block p-2 text-ink-subtle hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
        <button
          onClick={() => onDelete(journey.id)}
          aria-label="Delete this journey"
          className="hidden sm:block p-2 text-ink-subtle hover:text-red-500 hover:bg-danger-soft rounded-lg transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>

      {isEditing && (
        <div className="mt-3 pt-3 border-t border-line space-y-2">
          {/* The route as editable stops. A ground-transfer chain (NRT→HND)
              is rejected server-side with a message pointing at separate
              journeys, matching the add form's split behavior. */}
          <p className="text-xs text-ink-subtle">
            Changing the route rebuilds its stops - stop photos are removed
            with them.
          </p>
          <div className="space-y-1.5">
            {editStops.map((stop, index) => (
              <div key={index}>
                {/* The hop's mode, between its two stops. */}
                {index > 0 && (
                  <div className="flex flex-wrap items-center gap-1 ml-8 mb-1.5">
                    {HOP_MODES.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={editModes[index - 1] === mode}
                        title={MODE_LABEL[mode]}
                        aria-label={MODE_LABEL[mode]}
                        onClick={() => void changeEditMode(index - 1, mode)}
                        className={`min-h-7 px-2 rounded-full transition-colors ${
                          editModes[index - 1] === mode
                            ? 'bg-brand-600 text-white'
                            : 'bg-surface-sunken text-ink-muted hover:text-ink'
                        }`}
                      >
                        <ModeIcon mode={mode} className="w-4 h-4" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  {/* Reorder the chain without retyping stops. */}
                  <div className="flex flex-col flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => moveEditStop(index, -1)}
                      disabled={index === 0}
                      aria-label="Move this stop earlier"
                      title="Move earlier"
                      className="p-0.5 text-ink-subtle hover:text-brand-700 rounded disabled:opacity-30"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveEditStop(index, 1)}
                      disabled={index === editStops.length - 1}
                      aria-label="Move this stop later"
                      title="Move later"
                      className="p-0.5 text-ink-subtle hover:text-brand-700 rounded disabled:opacity-30"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    {stop.kind === 'airport' ? (
                      <AirportSearch
                        value={stop.airport}
                        onChange={(airport) => patchStop(index, { airport })}
                        placeholder={index === 0 ? 'From airport' : 'To airport'}
                      />
                    ) : (
                      <CitySearch
                        value={stop.city}
                        onChange={(cityValue) =>
                          patchStop(index, { city: cityValue })
                        }
                        placeholder={index === 0 ? 'From city' : 'To city'}
                      />
                    )}
                  </div>
                  {/* Airport or city, per stop: a train can leave from either. */}
                  <button
                    type="button"
                    onClick={() =>
                      patchStop(index, {
                        kind: stop.kind === 'airport' ? 'city' : 'airport',
                        airport: null,
                        city: null,
                      })
                    }
                    title={
                      stop.kind === 'airport'
                        ? 'This stop is an airport - switch to a city'
                        : 'This stop is a city - switch to an airport'
                    }
                    className={`flex-shrink-0 min-h-7 px-1.5 rounded-lg ${
                      stop.kind === 'city'
                        ? 'bg-secondary-soft/70 text-secondary-text hover:text-secondary-text'
                        : 'bg-surface-sunken text-ink-muted hover:text-ink'
                    }`}
                  >
                    {stop.kind === 'airport' ? (
                      <ModeIcon mode="flight" className="w-4 h-4" />
                    ) : (
                      <CityIcon className="w-4 h-4" />
                    )}
                  </button>
                  {editStops.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeStop(index)}
                      aria-label="Remove this stop"
                      className="flex-shrink-0 p-1.5 text-ink-subtle hover:text-red-500 rounded"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
            {flightHopViolation && (
              <p className="text-xs text-ink-muted">
                A flight hop ends in a city - saving will switch it to that
                city&rsquo;s airport automatically when it has one.
              </p>
            )}
            <button
              type="button"
              onClick={addStop}
              className="text-xs font-medium text-brand-text hover:text-brand-700 underline min-h-8"
            >
              + Add a stop
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="number"
              inputMode="numeric"
              min={1930}
              max={2100}
              placeholder="Year"
              aria-label="Year"
              value={editYear}
              onChange={(e) => {
                setEditYear(e.target.value);
                if (!e.target.value) {
                  setEditMonth('');
                  setEditDay('');
                }
              }}
              className="w-24 min-h-10 px-2 border border-line rounded-lg bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <select
              aria-label="Month (optional)"
              value={editMonth}
              disabled={!editYear}
              onChange={(e) => {
                setEditMonth(e.target.value);
                if (!e.target.value) setEditDay('');
              }}
              className="min-h-10 px-2 border border-line rounded-lg bg-surface text-ink text-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Month?</option>
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={String(i + 1).padStart(2, '0')}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label="Day (optional)"
              value={editDay}
              disabled={!editMonth}
              onChange={(e) => setEditDay(e.target.value)}
              className="min-h-10 px-2 border border-line rounded-lg bg-surface text-ink text-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Day?</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                  {i + 1}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 ml-2 cursor-pointer text-sm text-ink">
              <input
                type="checkbox"
                checked={editRoundTrip}
                onChange={(e) => {
                  setEditRoundTrip(e.target.checked);
                  // A manual choice replaces the automatic one, either way.
                  setRoundTripAutoCleared(false);
                }}
                className="w-4 h-4 text-brand-text rounded focus:ring-brand-500"
              />
              Round trip
            </label>
          </div>
          {roundTripAutoCleared && (
            <p className="text-xs text-ink-muted">
              Round trip unchecked - the route no longer ends where it
              started. Re-check it if that is still wrong.
            </p>
          )}
          <input
            type="text"
            placeholder="Notes"
            aria-label="Notes"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            className="w-full min-h-10 px-3 border border-line rounded-lg bg-surface text-ink text-sm placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex gap-2">
            <button
              onClick={saveEdit}
              disabled={isSaving}
              className="min-h-10 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
              className="min-h-10 px-4 rounded-lg text-sm font-medium text-ink-muted hover:bg-surface-sunken"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Leg details (collapsed by default, expandable in future) */}
      <div className="mt-3 pt-3 border-t border-line">
        <div className="flex flex-wrap gap-2">
          {journey.legs.map((leg, index) => (
            <div
              key={leg.id}
              className="flex items-center gap-1 text-xs text-ink-muted"
            >
              {/* Land legs announce their vehicle; flights stay quiet -
                  a plane on every row would be noise on a flight app. */}
              {legMode(leg) !== 'flight' && (
                <span aria-label={legMode(leg)} title={legMode(leg)}>
                  <ModeIcon mode={legMode(leg)} className="w-3.5 h-3.5" />
                </span>
              )}
              <span className="font-mono">
                {legEndpoints(leg)?.departure.iataCode ?? '?'}
              </span>
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
              <span className="font-mono">
                {legEndpoints(leg)?.arrival.iataCode ?? '?'}
              </span>
              <span className="text-ink-subtle">
                ({Math.round(Number(leg.distanceKm) || 0)} km)
              </span>
              {/* One postcard per stop; editing the route resets its
                  photos (legs are rebuilt), noted in the edit form. */}
              {leg.id && <StopPhotoControl legId={leg.id} />}
              {index < journey.legs.length - 1 && (
                <span className="text-gray-300 mx-1">|</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FlightCard;
