import { useState, useMemo } from 'react';
import { Country } from '../../types';

interface CountrySelectorProps {
  countries: Country[];
  visitedCountryIds: Set<number>;
  onToggleCountry: (countryId: number, countryName: string) => void;
}

function CountrySelector({ countries, visitedCountryIds, onToggleCountry }: CountrySelectorProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredCountries = useMemo(() => {
    if (!search.trim()) return countries;
    const searchLower = search.toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(searchLower) ||
        c.isoCode.toLowerCase().includes(searchLower)
    );
  }, [countries, search]);

  const handleSelect = (country: Country) => {
    onToggleCountry(country.id, country.name);
    setSearch('');
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search country to add/remove..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {isOpen && search.trim() && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredCountries.length === 0 ? (
            <div className="px-4 py-3 text-gray-500 text-sm">No countries found</div>
          ) : (
            filteredCountries.slice(0, 20).map((country) => {
              const isVisited = visitedCountryIds.has(country.id);
              return (
                <button
                  key={country.id}
                  onClick={() => handleSelect(country)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                >
                  <span className="text-gray-900">{country.name}</span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      isVisited
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {isVisited ? 'Visited - click to remove' : 'Click to add'}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

export default CountrySelector;
