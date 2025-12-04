import {
  useGetFlightsQuery,
  useRemoveFlightMutation,
} from '../../features/flights/flightsApi';
import FlightCard from './FlightCard';

function FlightList() {
  const { data: journeys = [], isLoading, error } = useGetFlightsQuery();
  const [removeFlight] = useRemoveFlightMutation();

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this flight?')) {
      try {
        await removeFlight(id).unwrap();
      } catch (err) {
        console.error('Failed to delete flight:', err);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse"
          >
            <div className="h-6 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Failed to load flights. Please try again.
      </div>
    );
  }

  if (journeys.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
        <svg
          className="w-12 h-12 mx-auto text-gray-400 mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
          />
        </svg>
        <h3 className="text-gray-900 font-medium mb-1">No flights yet</h3>
        <p className="text-gray-500 text-sm">
          Add your first flight to start tracking your journey!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Your Flights
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({journeys.length} {journeys.length === 1 ? 'journey' : 'journeys'})
          </span>
        </h2>
      </div>
      {journeys.map((journey) => (
        <FlightCard key={journey.id} journey={journey} onDelete={handleDelete} />
      ))}
    </div>
  );
}

export default FlightList;
