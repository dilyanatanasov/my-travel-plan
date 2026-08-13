import { Link } from 'react-router-dom';
import { DiscoveryPanel } from '../features/search/components';

/**
 * Standalone home for discovery at /search, replacing the orphaned
 * FlightSearchPage (which was already hidden from the nav; its files stay
 * as the v2 substrate — see context/research/2026-08-12).
 *
 * Same secondary-page chrome as Settings. When A docks DiscoveryPanel
 * beside the map (Q1), this page keeps working as the mobile "Explore all"
 * destination from the Overview card.
 */
function WhereNextPage() {
  return (
    <div className="scroll-page bg-canvas">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-3 mb-5">
          {/* Name chosen by the user 2026-08-12: "Where to next?" everywhere. */}
          <h1 className="font-display font-normal text-2xl text-ink flex items-center gap-2">
            Where to next?
            <span className="px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-semibold uppercase tracking-wide font-sans">
              Beta
            </span>
          </h1>
          <Link
            to="/"
            className="inline-flex items-center min-h-11 px-3 rounded-lg text-sm font-medium text-brand-700 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            Back to map
          </Link>
        </div>
        <DiscoveryPanel />
      </div>
    </div>
  );
}

export default WhereNextPage;
