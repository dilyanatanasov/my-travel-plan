import { useState } from 'react';
import AirportSearch from '../AirportSearch';
import type { Airport } from '../../types';

interface RouteBuilderProps {
  onSubmit: (data: {
    airportIds: number[];
    journeyDate?: string;
    isRoundTrip: boolean;
    notes?: string;
  }) => void;
  isLoading?: boolean;
}

function RouteBuilder({ onSubmit, isLoading }: RouteBuilderProps) {
  const [airports, setAirports] = useState<(Airport | null)[]>([null, null]);
  const [journeyDate, setJourneyDate] = useState('');
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [notes, setNotes] = useState('');

  const handleAirportChange = (index: number, airport: Airport | null) => {
    const newAirports = [...airports];
    newAirports[index] = airport;
    setAirports(newAirports);
  };

  const addLeg = () => {
    setAirports([...airports, null]);
  };

  const removeLeg = (index: number) => {
    if (airports.length <= 2) return;
    const newAirports = airports.filter((_, i) => i !== index);
    setAirports(newAirports);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validAirports = airports.filter((a): a is Airport => a !== null);
    if (validAirports.length < 2) return;

    onSubmit({
      airportIds: validAirports.map((a) => a.id),
      journeyDate: journeyDate || undefined,
      isRoundTrip,
      notes: notes || undefined,
    });

    // Reset form
    setAirports([null, null]);
    setJourneyDate('');
    setIsRoundTrip(false);
    setNotes('');
  };

  const validAirports = airports.filter((a): a is Airport => a !== null);
  const isValid = validAirports.length >= 2;
  const selectedIds = validAirports.map((a) => a.id);

  // Build route preview
  const routePreview = validAirports.map((a) => a.iataCode).join(' → ');
  const returnPreview = isRoundTrip && validAirports.length >= 2
    ? [...validAirports].reverse().map((a) => a.iataCode).join(' → ')
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        {airports.map((airport, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">
              {index + 1}
            </div>
            <div className="flex-1">
              <AirportSearch
                value={airport}
                onChange={(a) => handleAirportChange(index, a)}
                placeholder={index === 0 ? 'Start from...' : `Then to...`}
                excludeIds={selectedIds.filter((id) => id !== airport?.id)}
              />
            </div>
            {airports.length > 2 && (
              <button
                type="button"
                onClick={() => removeLeg(index)}
                className="flex-shrink-0 p-2 text-red-500 hover:bg-red-50 rounded-lg"
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
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addLeg}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add stop
      </button>

      {routePreview && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">Route preview:</div>
          <div className="font-mono text-lg text-gray-900">{routePreview}</div>
          {returnPreview && (
            <div className="font-mono text-lg text-gray-500 mt-1">
              + {returnPreview}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date (optional)
          </label>
          <input
            type="date"
            value={journeyDate}
            onChange={(e) => setJourneyDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRoundTrip}
              onChange={(e) => setIsRoundTrip(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Round trip</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes (optional)
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g., Business trip, vacation..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={!isValid || isLoading}
        className={`w-full py-2 px-4 rounded-lg text-white font-medium transition-colors ${
          isValid && !isLoading
            ? 'bg-blue-600 hover:bg-blue-700'
            : 'bg-gray-400 cursor-not-allowed'
        }`}
      >
        {isLoading ? 'Adding...' : 'Add Flight'}
      </button>
    </form>
  );
}

export default RouteBuilder;
