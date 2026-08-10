import { Outlet, Link } from 'react-router-dom';
import AccountMenu from '../../features/auth/AccountMenu';

function Layout() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          <Link to="/" className="block min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Travel Tracker
            </h1>
            {/* Subtitle is redundant with the page heading on small screens */}
            <p className="hidden sm:block text-sm text-gray-500">
              Track your journeys around the world
            </p>
          </Link>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              to="/search"
              className="flex items-center gap-2 min-h-11 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg
                className="w-5 h-5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {/* Label hidden on phones so the button never wraps to two lines */}
              <span className="hidden sm:inline whitespace-nowrap">
                Search Flights
              </span>
              <span className="sr-only sm:hidden">Search Flights</span>
            </Link>
            <AccountMenu />
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
