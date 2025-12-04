import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlightJourney } from './entities/flight-journey.entity';
import { FlightLeg } from './entities/flight-leg.entity';

export interface YearStats {
  year: number;
  flights: number;
  distanceKm: number;
}

export interface MonthStats {
  year: number;
  month: number;
  flights: number;
  distanceKm: number;
}

export interface AirportVisitCount {
  airportId: number;
  iataCode: string;
  name: string;
  city: string;
  country: string;
  visitCount: number;
}

export interface RouteCount {
  fromAirportId: number;
  fromIataCode: string;
  fromCity: string;
  toAirportId: number;
  toIataCode: string;
  toCity: string;
  count: number;
  distanceKm: number;
}

export interface FlightStats {
  // Core stats
  totalFlights: number;
  totalJourneys: number;
  totalDistanceKm: number;

  // Time-based
  byYear: YearStats[];
  byMonth: MonthStats[];
  strongestYear: YearStats | null;
  strongestMonth: MonthStats | null;

  // Records
  longestFlight: {
    departureIata: string;
    departureCity: string;
    arrivalIata: string;
    arrivalCity: string;
    distanceKm: number;
  } | null;
  shortestFlight: {
    departureIata: string;
    departureCity: string;
    arrivalIata: string;
    arrivalCity: string;
    distanceKm: number;
  } | null;
  mostVisitedAirports: AirportVisitCount[];
  mostCommonRoutes: RouteCount[];

  // Geographic
  uniqueAirports: number;
  uniqueCountries: number;
  countriesVisited: string[];

  // Creative
  earthCircumferences: number;
  moonDistancePercent: number;
  estimatedFlightHours: number;
  walkingYears: number;
}

@Injectable()
export class FlightsStatsService {
  private readonly EARTH_CIRCUMFERENCE_KM = 40075;
  private readonly MOON_DISTANCE_KM = 384400;
  private readonly AVG_FLIGHT_SPEED_KMH = 800;
  private readonly WALKING_SPEED_KMH = 5;

  constructor(
    @InjectRepository(FlightJourney)
    private readonly journeyRepository: Repository<FlightJourney>,
    @InjectRepository(FlightLeg)
    private readonly legRepository: Repository<FlightLeg>,
  ) {}

  async getStats(): Promise<FlightStats> {
    // Get all journeys with legs
    const journeys = await this.journeyRepository.find({
      relations: ['legs', 'legs.departureAirport', 'legs.arrivalAirport'],
    });

    // Flatten all legs
    const allLegs = journeys.flatMap((j) => j.legs);

    // Core stats
    const totalJourneys = journeys.length;
    const totalFlights = allLegs.length;
    const totalDistanceKm = allLegs.reduce(
      (sum, leg) => sum + Number(leg.distanceKm || 0),
      0,
    );

    // Time-based stats
    const byYear = this.calculateByYear(journeys);
    const byMonth = this.calculateByMonth(journeys);
    const strongestYear = this.findStrongestYear(byYear);
    const strongestMonth = this.findStrongestMonth(byMonth);

    // Records
    const longestFlight = this.findLongestFlight(allLegs);
    const shortestFlight = this.findShortestFlight(allLegs);
    const mostVisitedAirports = this.calculateMostVisitedAirports(allLegs);
    const mostCommonRoutes = this.calculateMostCommonRoutes(allLegs);

    // Geographic
    const { uniqueAirports, uniqueCountries, countriesVisited } =
      this.calculateGeographicStats(allLegs);

    // Creative
    const earthCircumferences = Math.round((totalDistanceKm / this.EARTH_CIRCUMFERENCE_KM) * 100) / 100;
    const moonDistancePercent = Math.round((totalDistanceKm / this.MOON_DISTANCE_KM) * 10000) / 100;
    const estimatedFlightHours = Math.round((totalDistanceKm / this.AVG_FLIGHT_SPEED_KMH) * 10) / 10;
    const walkingYears =
      Math.round(
        (totalDistanceKm / (this.WALKING_SPEED_KMH * 24 * 365)) * 100,
      ) / 100;

    return {
      totalFlights,
      totalJourneys,
      totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
      byYear,
      byMonth,
      strongestYear,
      strongestMonth,
      longestFlight,
      shortestFlight,
      mostVisitedAirports,
      mostCommonRoutes,
      uniqueAirports,
      uniqueCountries,
      countriesVisited,
      earthCircumferences,
      moonDistancePercent,
      estimatedFlightHours,
      walkingYears,
    };
  }

  private calculateByYear(journeys: FlightJourney[]): YearStats[] {
    const yearMap = new Map<number, { flights: number; distanceKm: number }>();

    for (const journey of journeys) {
      if (!journey.journeyDate) continue;
      const year = new Date(journey.journeyDate).getFullYear();

      const existing = yearMap.get(year) || { flights: 0, distanceKm: 0 };
      existing.flights += journey.legs.length;
      existing.distanceKm += journey.legs.reduce(
        (sum, leg) => sum + Number(leg.distanceKm || 0),
        0,
      );
      yearMap.set(year, existing);
    }

    return Array.from(yearMap.entries())
      .map(([year, stats]) => ({
        year,
        flights: stats.flights,
        distanceKm: Math.round(stats.distanceKm * 100) / 100,
      }))
      .sort((a, b) => b.year - a.year);
  }

  private calculateByMonth(journeys: FlightJourney[]): MonthStats[] {
    const monthMap = new Map<string, { year: number; month: number; flights: number; distanceKm: number }>();

    for (const journey of journeys) {
      if (!journey.journeyDate) continue;
      const date = new Date(journey.journeyDate);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;

      const existing = monthMap.get(key) || { year, month, flights: 0, distanceKm: 0 };
      existing.flights += journey.legs.length;
      existing.distanceKm += journey.legs.reduce(
        (sum, leg) => sum + Number(leg.distanceKm || 0),
        0,
      );
      monthMap.set(key, existing);
    }

    return Array.from(monthMap.values())
      .map((stats) => ({
        ...stats,
        distanceKm: Math.round(stats.distanceKm * 100) / 100,
      }))
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
  }

  private findStrongestYear(byYear: YearStats[]): YearStats | null {
    if (byYear.length === 0) return null;
    return byYear.reduce((max, year) =>
      year.distanceKm > max.distanceKm ? year : max,
    );
  }

  private findStrongestMonth(byMonth: MonthStats[]): MonthStats | null {
    if (byMonth.length === 0) return null;
    return byMonth.reduce((max, month) =>
      month.distanceKm > max.distanceKm ? month : max,
    );
  }

  private findLongestFlight(legs: FlightLeg[]) {
    if (legs.length === 0) return null;
    const longest = legs.reduce((max, leg) =>
      Number(leg.distanceKm) > Number(max.distanceKm) ? leg : max,
    );
    return {
      departureIata: longest.departureAirport.iataCode,
      departureCity: longest.departureAirport.city,
      arrivalIata: longest.arrivalAirport.iataCode,
      arrivalCity: longest.arrivalAirport.city,
      distanceKm: Math.round(Number(longest.distanceKm) * 100) / 100,
    };
  }

  private findShortestFlight(legs: FlightLeg[]) {
    if (legs.length === 0) return null;
    const shortest = legs.reduce((min, leg) =>
      Number(leg.distanceKm) < Number(min.distanceKm) ? leg : min,
    );
    return {
      departureIata: shortest.departureAirport.iataCode,
      departureCity: shortest.departureAirport.city,
      arrivalIata: shortest.arrivalAirport.iataCode,
      arrivalCity: shortest.arrivalAirport.city,
      distanceKm: Math.round(Number(shortest.distanceKm) * 100) / 100,
    };
  }

  private calculateMostVisitedAirports(legs: FlightLeg[]): AirportVisitCount[] {
    const airportCounts = new Map<number, AirportVisitCount>();

    for (const leg of legs) {
      // Count departure
      const depId = leg.departureAirport.id;
      const depExisting = airportCounts.get(depId);
      if (depExisting) {
        depExisting.visitCount++;
      } else {
        airportCounts.set(depId, {
          airportId: depId,
          iataCode: leg.departureAirport.iataCode,
          name: leg.departureAirport.name,
          city: leg.departureAirport.city,
          country: leg.departureAirport.country,
          visitCount: 1,
        });
      }

      // Count arrival
      const arrId = leg.arrivalAirport.id;
      const arrExisting = airportCounts.get(arrId);
      if (arrExisting) {
        arrExisting.visitCount++;
      } else {
        airportCounts.set(arrId, {
          airportId: arrId,
          iataCode: leg.arrivalAirport.iataCode,
          name: leg.arrivalAirport.name,
          city: leg.arrivalAirport.city,
          country: leg.arrivalAirport.country,
          visitCount: 1,
        });
      }
    }

    return Array.from(airportCounts.values())
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, 10);
  }

  private calculateMostCommonRoutes(legs: FlightLeg[]): RouteCount[] {
    const routeCounts = new Map<string, RouteCount>();

    for (const leg of legs) {
      // Create a normalized key (smaller airport ID first for bidirectional counting)
      const ids = [leg.departureAirport.id, leg.arrivalAirport.id].sort((a, b) => a - b);
      const key = `${ids[0]}-${ids[1]}`;

      const existing = routeCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        routeCounts.set(key, {
          fromAirportId: leg.departureAirport.id,
          fromIataCode: leg.departureAirport.iataCode,
          fromCity: leg.departureAirport.city,
          toAirportId: leg.arrivalAirport.id,
          toIataCode: leg.arrivalAirport.iataCode,
          toCity: leg.arrivalAirport.city,
          count: 1,
          distanceKm: Math.round(Number(leg.distanceKm) * 100) / 100,
        });
      }
    }

    return Array.from(routeCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private calculateGeographicStats(legs: FlightLeg[]) {
    const airportIds = new Set<number>();
    const countries = new Set<string>();

    for (const leg of legs) {
      airportIds.add(leg.departureAirport.id);
      airportIds.add(leg.arrivalAirport.id);
      if (leg.departureAirport.country) {
        countries.add(leg.departureAirport.country);
      }
      if (leg.arrivalAirport.country) {
        countries.add(leg.arrivalAirport.country);
      }
    }

    return {
      uniqueAirports: airportIds.size,
      uniqueCountries: countries.size,
      countriesVisited: Array.from(countries).sort(),
    };
  }
}
