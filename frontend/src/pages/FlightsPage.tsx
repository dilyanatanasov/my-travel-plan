import FlightForm from '../components/FlightForm';
import FlightList from '../components/FlightList';
import FlightStats from '../components/FlightStats';

function FlightsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Flight Tracker
          </h1>
          <p className="text-gray-500">
            Track all your flights and see amazing statistics
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Form and List */}
          <div className="lg:col-span-1 space-y-6">
            <FlightForm />
            <FlightList />
          </div>

          {/* Right column - Stats */}
          <div className="lg:col-span-2">
            <FlightStats />
          </div>
        </div>
      </div>
    </div>
  );
}

export default FlightsPage;
