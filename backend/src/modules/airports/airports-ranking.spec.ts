import { Airport } from './entities/airport.entity';
import { rankAirports } from './airports.service';

/**
 * The search ranking heuristic: majors before minors when searching by
 * country, exact code always first.
 */

function airport(iataCode: string, name: string, city: string): Airport {
  return { iataCode, name, city, country: 'Italy' } as Airport;
}

describe('rankAirports', () => {
  const italy = [
    airport('AOI', 'Ancona Falconara Airport', 'Ancona'),
    airport('FCO', 'Leonardo da Vinci International Airport', 'Rome'),
    airport('BLQ', 'Bologna Guglielmo Marconi Airport', 'Bologna'),
    airport('MXP', 'Milan Malpensa International Airport', 'Milan'),
  ];

  it('puts the majors first for a country search', () => {
    const ranked = rankAirports(italy, 'italy').map((a) => a.iataCode);
    expect(ranked.slice(0, 2)).toEqual(['FCO', 'MXP']);
    expect(ranked).toHaveLength(4);
  });

  it('an exact IATA code beats everything', () => {
    const ranked = rankAirports(italy, 'AOI').map((a) => a.iataCode);
    expect(ranked[0]).toBe('AOI');
  });

  it('a city-name search lifts that city', () => {
    const ranked = rankAirports(italy, 'bologna').map((a) => a.iataCode);
    expect(ranked[0]).toBe('BLQ');
  });
});
