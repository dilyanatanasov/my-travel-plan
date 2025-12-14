import { useState } from 'react';
import AirportSearch from '../../../components/AirportSearch/AirportSearch';
import type { Airport, SearchFlightsDto, CabinClass } from '../../../types';

interface SearchFormProps {
  onSearch: (params: SearchFlightsDto) => void;
  isLoading: boolean;
}

function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [origin, setOrigin] = useState<Airport | null>(null);
  const [destination, setDestination] = useState<Airport | null>(null);
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [cabinClass, setCabinClass] = useState<CabinClass>('economy');
  const [isRoundTrip, setIsRoundTrip] = useState(true);

  const [errors, setErrors] = useState<{
    origin?: string;
    destination?: string;
    departureDate?: string;
    returnDate?: string;
    passengers?: string;
  }>({});

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!origin) {
      newErrors.origin = 'Origin airport is required';
    }

    if (!destination) {
      newErrors.destination = 'Destination airport is required';
    }

    if (!departureDate) {
      newErrors.departureDate = 'Departure date is required';
    }

    if (isRoundTrip && returnDate) {
      const departure = new Date(departureDate);
      const returnD = new Date(returnDate);
      if (returnD <= departure) {
        newErrors.returnDate = 'Return date must be after departure date';
      }
    }

    if (passengers < 1 || passengers > 9) {
      newErrors.passengers = 'Passengers must be between 1 and 9';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const searchParams: SearchFlightsDto = {
      origin: origin!.iataCode,
      destination: destination!.iataCode,
      departureDate,
      returnDate: isRoundTrip && returnDate ? returnDate : undefined,
      passengers,
      cabinClass,
    };

    onSearch(searchParams);
  };

  const handleSwapAirports = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="roundTrip"
            checked={isRoundTrip}
            onChange={(e) => setIsRoundTrip(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor="roundTrip" className="text-sm font-medium text-gray-700">
            Round-trip
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Origin
            </label>
            <AirportSearch
              value={origin}
              onChange={setOrigin}
              placeholder="Search origin airport..."
              excludeIds={destination ? [destination.id] : []}
            />
            {errors.origin && (
              <p className="mt-1 text-sm text-red-600">{errors.origin}</p>
            )}
          </div>

          <div className="flex items-end pb-2">
            <button
              type="button"
              onClick={handleSwapAirports}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isLoading}
              title="Swap airports"
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
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Destination
            </label>
            <AirportSearch
              value={destination}
              onChange={setDestination}
              placeholder="Search destination airport..."
              excludeIds={origin ? [origin.id] : []}
            />
            {errors.destination && (
              <p className="mt-1 text-sm text-red-600">{errors.destination}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="departureDate" className="block text-sm font-medium text-gray-700 mb-1">
              Departure Date
            </label>
            <input
              type="date"
              id="departureDate"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              min={today}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.departureDate && (
              <p className="mt-1 text-sm text-red-600">{errors.departureDate}</p>
            )}
          </div>

          {isRoundTrip && (
            <div>
              <label htmlFor="returnDate" className="block text-sm font-medium text-gray-700 mb-1">
                Return Date
              </label>
              <input
                type="date"
                id="returnDate"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                min={departureDate || today}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.returnDate && (
                <p className="mt-1 text-sm text-red-600">{errors.returnDate}</p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="passengers" className="block text-sm font-medium text-gray-700 mb-1">
              Passengers
            </label>
            <input
              type="number"
              id="passengers"
              value={passengers}
              onChange={(e) => setPassengers(Number(e.target.value))}
              min={1}
              max={9}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.passengers && (
              <p className="mt-1 text-sm text-red-600">{errors.passengers}</p>
            )}
          </div>

          <div>
            <label htmlFor="cabinClass" className="block text-sm font-medium text-gray-700 mb-1">
              Cabin Class
            </label>
            <select
              id="cabinClass"
              value={cabinClass}
              onChange={(e) => setCabinClass(e.target.value as CabinClass)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="economy">Economy</option>
              <option value="premium_economy">Premium Economy</option>
              <option value="business">Business</option>
              <option value="first">First Class</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Searching...' : 'Search Flights'}
        </button>
      </form>
    </div>
  );
}

export default SearchForm;
