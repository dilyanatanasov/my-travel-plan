import { useState, useMemo } from 'react';
import AirportSearch from '../../../../components/AirportSearch/AirportSearch';
import type { Airport, FlexibleSearchDto, CabinClass, DateType } from '../../../../types';

interface FlexibleSearchFormProps {
  onSearch: (params: FlexibleSearchDto) => void;
  isLoading: boolean;
}

function FlexibleSearchForm({ onSearch, isLoading }: FlexibleSearchFormProps) {
  // Airport state
  const [origin, setOrigin] = useState<Airport | null>(null);
  const [destination, setDestination] = useState<Airport | null>(null);

  // Date type selection
  const [dateType, setDateType] = useState<DateType>('range');

  // Specific dates (for dateType === 'specific')
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');

  // Month selection (for dateType === 'month')
  const [selectedMonth, setSelectedMonth] = useState('');

  // Date range (for dateType === 'range' or 'weekends')
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');

  // Duration
  const [minNights, setMinNights] = useState(3);
  const [maxNights, setMaxNights] = useState(7);

  // Common options
  const [passengers, setPassengers] = useState(1);
  const [cabinClass, setCabinClass] = useState<CabinClass>('economy');

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Generate month options (next 12 months)
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  }, []);

  const today = new Date().toISOString().split('T')[0];

  // Calculate max date (1 year from now)
  const maxDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().split('T')[0];
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!origin) {
      newErrors.origin = 'Origin airport is required';
    }
    if (!destination) {
      newErrors.destination = 'Destination airport is required';
    }

    if (dateType === 'specific') {
      if (!departureDate) {
        newErrors.departureDate = 'Departure date is required';
      }
      if (!returnDate) {
        newErrors.returnDate = 'Return date is required';
      } else if (departureDate && new Date(returnDate) <= new Date(departureDate)) {
        newErrors.returnDate = 'Return date must be after departure';
      }
    }

    if (dateType === 'month') {
      if (!selectedMonth) {
        newErrors.month = 'Please select a month';
      }
    }

    if (dateType === 'range' || dateType === 'weekends') {
      if (!dateRangeStart) {
        newErrors.dateRangeStart = 'Start date is required';
      }
      if (!dateRangeEnd) {
        newErrors.dateRangeEnd = 'End date is required';
      } else if (dateRangeStart && new Date(dateRangeEnd) <= new Date(dateRangeStart)) {
        newErrors.dateRangeEnd = 'End date must be after start date';
      }
    }

    if (minNights > maxNights) {
      newErrors.duration = 'Min nights cannot exceed max nights';
    }

    if (passengers < 1 || passengers > 9) {
      newErrors.passengers = 'Passengers must be between 1 and 9';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const params: FlexibleSearchDto = {
      origin: origin!.iataCode,
      destination: destination!.iataCode,
      dateType,
      passengers,
      cabinClass,
      minNights: dateType === 'specific' ? 0 : minNights,
      maxNights: dateType === 'specific' ? 0 : maxNights,
    };

    if (dateType === 'specific') {
      params.departureDate = departureDate;
      params.returnDate = returnDate;
    } else if (dateType === 'month') {
      params.month = selectedMonth;
    } else {
      params.dateRangeStart = dateRangeStart;
      params.dateRangeEnd = dateRangeEnd;
    }

    onSearch(params);
  };

  const handleSwapAirports = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Explore Flights</h2>
      <p className="text-sm text-gray-600 mb-6">
        Search flexibly by month, date range, or weekends to find the best deals.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Airports */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To
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

        {/* Date Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            When do you want to travel?
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'specific', label: 'Specific Dates' },
              { value: 'month', label: 'Entire Month' },
              { value: 'range', label: 'Date Range' },
              { value: 'weekends', label: 'Weekends Only' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDateType(option.value as DateType)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dateType === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Inputs based on type */}
        {dateType === 'specific' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Departure Date
              </label>
              <input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                min={today}
                max={maxDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.departureDate && (
                <p className="mt-1 text-sm text-red-600">{errors.departureDate}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Return Date
              </label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                min={departureDate || today}
                max={maxDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.returnDate && (
                <p className="mt-1 text-sm text-red-600">{errors.returnDate}</p>
              )}
            </div>
          </div>
        )}

        {dateType === 'month' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a month...</option>
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.month && (
              <p className="mt-1 text-sm text-red-600">{errors.month}</p>
            )}
          </div>
        )}

        {(dateType === 'range' || dateType === 'weekends') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From
              </label>
              <input
                type="date"
                value={dateRangeStart}
                onChange={(e) => setDateRangeStart(e.target.value)}
                min={today}
                max={maxDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.dateRangeStart && (
                <p className="mt-1 text-sm text-red-600">{errors.dateRangeStart}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To
              </label>
              <input
                type="date"
                value={dateRangeEnd}
                onChange={(e) => setDateRangeEnd(e.target.value)}
                min={dateRangeStart || today}
                max={maxDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.dateRangeEnd && (
                <p className="mt-1 text-sm text-red-600">{errors.dateRangeEnd}</p>
              )}
            </div>
          </div>
        )}

        {/* Duration (for flexible searches) */}
        {dateType !== 'specific' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How long do you want to stay?
            </label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={minNights}
                  onChange={(e) => setMinNights(Math.max(1, Number(e.target.value)))}
                  min={1}
                  max={30}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                />
                <span className="text-gray-600">to</span>
                <input
                  type="number"
                  value={maxNights}
                  onChange={(e) => setMaxNights(Math.max(minNights, Number(e.target.value)))}
                  min={minNights}
                  max={30}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                />
                <span className="text-gray-600">nights</span>
              </div>
            </div>
            {errors.duration && (
              <p className="mt-1 text-sm text-red-600">{errors.duration}</p>
            )}
          </div>
        )}

        {/* Passengers and Cabin Class */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Passengers
            </label>
            <input
              type="number"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cabin Class
            </label>
            <select
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

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Searching... This may take a moment
            </span>
          ) : (
            'Explore Flights'
          )}
        </button>
      </form>
    </div>
  );
}

export default FlexibleSearchForm;
