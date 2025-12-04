import { useState } from 'react';
import SimpleFlightForm from './SimpleFlightForm';
import RouteBuilder from './RouteBuilder';
import { useAddFlightMutation } from '../../features/flights/flightsApi';

type FormMode = 'simple' | 'builder';

function FlightForm() {
  const [mode, setMode] = useState<FormMode>('simple');
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Add Flight</h2>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setMode('simple')}
            className={`px-3 py-1 text-sm font-medium transition-colors ${
              mode === 'simple'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Simple
          </button>
          <button
            onClick={() => setMode('builder')}
            className={`px-3 py-1 text-sm font-medium transition-colors ${
              mode === 'builder'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Multi-leg
          </button>
        </div>
      </div>

      {mode === 'simple' ? (
        <SimpleFlightForm onSubmit={handleSubmit} isLoading={isLoading} />
      ) : (
        <RouteBuilder onSubmit={handleSubmit} isLoading={isLoading} />
      )}
    </div>
  );
}

export default FlightForm;
