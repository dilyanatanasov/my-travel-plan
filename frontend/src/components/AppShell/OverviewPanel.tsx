import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useGetFlightsQuery } from '../../features/flights/flightsApi';
import JourneyHighlightCard from './JourneyHighlightCard';
import RegionProgress from './RegionProgress';
import DailyCard from '../../features/daily/DailyCard';
import type { Country, FlightJourney, Visit } from '../../types';

interface OverviewPanelProps {
  countries: Country[];
  visits: Visit[];
  tripCount: number;
  /** Visited bonus places (ISO territories) - shown, never counted. */
  territoryCount: number;
  transitCount: number;
  worldPercent: number;
  totalCountries: number;
  homeCountry: string;
}

function StatTile({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: string;
}) {
  return (
    <div className={`rounded-xl p-3 ${tone}`}>
      <div className="font-display font-normal text-2xl">{value}</div>
      <div className="text-xs text-ink-muted mt-0.5">{label}</div>
    </div>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between a journey date and today; negative means in the past. */
function daysFromToday(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / DAY_MS);
}

/**
 * The Overview.
 *
 * It used to be four totals and a paragraph of instructions, which answered
 * "how much have I travelled" and nothing else. The two questions people
 * actually open an app like this for are "when do I fly next" and "where did
 * I just come back from", so both are promoted here and both are clickable
 * straight through to the map.
 *
 * Upcoming flights fall out of data we already hold: a journey dated in the
 * future is one you have logged but not taken. Nothing new is stored.
 */
function OverviewPanel({
  countries,
  visits,
  tripCount,
  territoryCount,
  transitCount,
  worldPercent,
  totalCountries,
  homeCountry,
}: OverviewPanelProps) {
  const { data: journeys = [] } = useGetFlightsQuery();

  const { next, last } = useMemo(() => {
    let next: { journey: FlightJourney; days: number } | null = null;
    let last: { journey: FlightJourney; days: number } | null = null;

    for (const journey of journeys) {
      if (!journey.journeyDate) continue;
      const days = daysFromToday(journey.journeyDate);
      if (days >= 0) {
        // Soonest future journey wins.
        if (!next || days < next.days) next = { journey, days };
      } else if (!last || days > last.days) {
        // Least-negative past journey is the most recent one.
        last = { journey, days };
      }
    }
    return { next, last };
  }, [journeys]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          value={String(tripCount)}
          label={
            territoryCount > 0
              ? `Countries visited + ${territoryCount} ${
                  territoryCount === 1 ? 'territory' : 'territories'
                }`
              : 'Countries visited'
          }
          tone="bg-map-visited/15 text-ink"
        />
        <StatTile
          value={String(transitCount)}
          label="Transit countries"
          tone="bg-map-transit/20 text-ink"
        />
        <StatTile
          value={`${worldPercent}%`}
          label={`Of the world (${tripCount}/${totalCountries})`}
          tone="bg-brand-500/15 text-ink"
        />
        {/* "Not set" was a dead end (friend feedback, 2026-08-17): the tile
            that names the gap now opens the place that fixes it. */}
        {homeCountry === 'Not set' ? (
          <Link
            to="/settings"
            className="rounded-xl p-3 bg-surface-sunken text-ink hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
          >
            <div className="font-display font-normal text-2xl">Not set</div>
            <div className="text-xs text-brand-text mt-0.5 font-medium">
              Home country - set it →
            </div>
          </Link>
        ) : (
          <StatTile
            value={homeCountry}
            label="Home country"
            tone="bg-surface-sunken text-ink"
          />
        )}
      </div>

      {next && (
        <JourneyHighlightCard
          journey={next.journey}
          kicker="Next flight"
          relativeDays={next.days}
          isUpcoming
        />
      )}

      {last && (
        <JourneyHighlightCard
          journey={last.journey}
          kicker="Last flight"
          relativeDays={Math.abs(last.days)}
          isUpcoming={false}
        />
      )}

      <RegionProgress countries={countries} visits={visits} />

      <DailyCard />

      {!next && !last && (
        <p className="text-sm text-ink-muted">
          Tap any country on the map to mark it visited, or add a flight and
          watch it fly. Future-dated flights show up here as your next trip.
        </p>
      )}
    </div>
  );
}

export default OverviewPanel;
