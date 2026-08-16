import { Link } from 'react-router-dom';
import TripSearchPanel from '../features/search/tripSearch/TripSearchPanel';

/**
 * The v2 funnel at /search/trips: you know WHERE, this finds WHEN — the
 * discovery page next door answers the opposite question. Same secondary
 * chrome as WhereNextPage.
 */
function TripSearchPage() {
  return (
    <div className="scroll-page bg-canvas">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-3 mb-5">
          <h1 className="font-display font-normal text-2xl text-ink flex items-center gap-2">
            Find the right dates
            <span className="px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-semibold uppercase tracking-wide font-sans">
              Beta
            </span>
          </h1>
          <div className="flex items-center gap-1">
            <Link
              to="/search"
              className="inline-flex items-center min-h-11 px-3 rounded-lg text-sm font-medium text-brand-700 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              Where to next?
            </Link>
            <Link
              to="/"
              className="inline-flex items-center min-h-11 px-3 rounded-lg text-sm font-medium text-brand-700 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              Back to map
            </Link>
          </div>
        </div>
        <TripSearchPanel />
      </div>
    </div>
  );
}

export default TripSearchPage;
