import RouteBuilder from './RouteBuilder';
import { useAddFlightMutation } from '../../features/flights/flightsApi';

function FlightForm() {
  const [addFlight, { isLoading }] = useAddFlightMutation();

  const handleSubmit = async (data: {
    airportIds: number[];
    journeyDate?: string;
    isRoundTrip: boolean;
    notes?: string;
  }) => {
    try {
      await addFlight(data).unwrap();
    } catch (error) {
      console.error('Failed to add flight:', error);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Flight</h2>
      <RouteBuilder onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  );
}

export default FlightForm;
