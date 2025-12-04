import { useState } from 'react';
import AirportSearch from '../AirportSearch';
import type { Airport } from '../../types';

interface SimpleFlightFormProps {
  onSubmit: (data: {
    airportIds: number[];
    journeyDate?: string;
    isRoundTrip: boolean;
    notes?: string;
  }) => void;
  isLoading?: boolean;
}

function SimpleFlightForm({ onSubmit, isLoading }: SimpleFlightFormProps) {
  const [departure, setDeparture] = useState<Airport | null>(null);
  const [arrival, setArrival] = useState<Airport | null>(null);
  const [journeyDate, setJourneyDate] = useState('');
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!departure || !arrival) return;

    onSubmit({
      airportIds: [departure.id, arrival.id],
      journeyDate: journeyDate || undefined,
      isRoundTrip,
      notes: notes || undefined,
    });

    // Reset form
    setDeparture(null);
    setArrival(null);
    setJourneyDate('');
    setIsRoundTrip(false);
    setNotes('');
  };

  const isValid = departure && arrival && departure.id !== arrival.id;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            From
          </label>
          <AirportSearch
            value={departure}
            onChange={setDeparture}
            placeholder="Departure airport..."
            excludeIds={arrival ? [arrival.id] : []}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            To
          </label>
          <AirportSearch
            value={arrival}
            onChange={setArrival}
            placeholder="Arrival airport..."
            excludeIds={departure ? [departure.id] : []}
          />
        </div>
      </div>

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
          {isRoundTrip && departure && arrival && (
            <span className="ml-2 text-xs text-gray-500">
              (+ {arrival.iataCode} → {departure.iataCode})
            </span>
          )}
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

export default SimpleFlightForm;
