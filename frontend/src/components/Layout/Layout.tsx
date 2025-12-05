import { Outlet, Link } from 'react-router-dom';

function Layout() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="block">
            <h1 className="text-2xl font-bold text-gray-900">Travel Tracker</h1>
            <p className="text-sm text-gray-500">
              Track your journeys around the world
            </p>
          </Link>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
