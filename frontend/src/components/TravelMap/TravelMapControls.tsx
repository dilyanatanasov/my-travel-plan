import { memo } from 'react';
import type { Country } from '../../types';
import { COUNTRY_COLORS } from './countryColors';

export interface TravelMapSettings {
  showCountries: boolean;
  showFlights: boolean;
  showAirports: boolean;
}

interface TravelMapControlsProps {
  settings: TravelMapSettings;
  onSettingsChange: (settings: TravelMapSettings) => void;
  countries: Country[];
  homeCountryId: number | null;
  onSetHomeCountry: (countryId: number) => void;
  stats: {
    visitedCount: number;
    transitCount: number;
    totalCountries: number;
    flightRoutes: number;
    airports: number;
  };
}

function TravelMapControls({
  settings,
  onSettingsChange,
  countries,
  homeCountryId,
  onSetHomeCountry,
  stats,
}: TravelMapControlsProps) {
  const handleToggle = (key: keyof TravelMapSettings) => {
    onSettingsChange({
      ...settings,
      [key]: !settings[key],
    });
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Layer Toggles */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Show:</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showCountries}
              onChange={() => handleToggle('showCountries')}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Countries</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showFlights}
              onChange={() => handleToggle('showFlights')}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Flight Routes</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showAirports}
              onChange={() => handleToggle('showAirports')}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Airports</span>
          </label>
        </div>

        {/* Home Country Selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Home:</label>
          <select
            value={homeCountryId || ''}
            onChange={(e) => {
              const id = parseInt(e.target.value, 10);
              if (id) onSetHomeCountry(id);
            }}
            className="text-sm border border-gray-300 rounded px-2 py-1 bg-white min-w-[150px]"
          >
            <option value="">Select home country</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-6 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: COUNTRY_COLORS.home }}
            />
            <span className="text-gray-600">Home</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: COUNTRY_COLORS.trip }}
            />
            <span className="text-gray-600">Visited</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: COUNTRY_COLORS.transit }}
            />
            <span className="text-gray-600">Transit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-blue-500 rounded" />
            <span className="text-gray-600">Flight route</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-gray-600">Airport</span>
          </div>

          {/* Stats */}
          <span className="text-gray-400 ml-auto">
            {stats.visitedCount} visited • {stats.transitCount} transit •{' '}
            {stats.flightRoutes} routes • {stats.airports} airports
          </span>
        </div>
      </div>
    </div>
  );
}

export default memo(TravelMapControls);
