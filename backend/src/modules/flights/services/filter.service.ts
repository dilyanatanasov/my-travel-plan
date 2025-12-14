import { Injectable, Logger } from '@nestjs/common';
import { FilterOptionsDto } from '../dto/filter-options.dto';
import {
  FlightResultDto,
  FlightSearchResultDto,
  FlightLegDto,
} from '../dto/flight-result.dto';

export type SortOption =
  | 'price_asc'
  | 'price_desc'
  | 'duration_asc'
  | 'duration_desc'
  | 'departure_asc'
  | 'departure_desc'
  | 'stops_asc';

@Injectable()
export class FilterService {
  private readonly logger = new Logger(FilterService.name);

  /**
   * Apply filters to flight search results
   * Filters are applied in sequence: stops -> layover -> price -> duration -> airlines
   */
  applyFilters(
    searchResult: FlightSearchResultDto,
    filters: FilterOptionsDto,
    sortBy?: SortOption,
  ): FlightSearchResultDto {
    let filteredResults = [...searchResult.results];

    // Apply filters in sequence
    filteredResults = this.filterByStops(filteredResults, filters);
    filteredResults = this.filterByLayover(filteredResults, filters);
    filteredResults = this.filterByPrice(filteredResults, filters);
    filteredResults = this.filterByDuration(filteredResults, filters);
    filteredResults = this.filterByAirlines(filteredResults, filters);

    // Apply sorting
    if (sortBy) {
      filteredResults = this.sortResults(filteredResults, sortBy);
    }

    this.logger.debug(
      `Filtered ${searchResult.results.length} results to ${filteredResults.length}`,
    );

    return {
      ...searchResult,
      results: filteredResults,
      totalResults: filteredResults.length,
      // Recalculate filter stats for filtered results
      filterStats: this.recalculateFilterStats(filteredResults, searchResult),
    };
  }

  /**
   * Filter by maximum number of stops
   */
  private filterByStops(
    results: FlightResultDto[],
    filters: FilterOptionsDto,
  ): FlightResultDto[] {
    if (filters.maxStops === undefined) {
      return results;
    }

    return results.filter((flight) => {
      // Check outbound leg stops
      if (flight.outboundLeg.stopCount > filters.maxStops!) {
        return false;
      }

      // Check return leg stops if present
      if (flight.returnLeg && flight.returnLeg.stopCount > filters.maxStops!) {
        return false;
      }

      return true;
    });
  }

  /**
   * Filter by layover duration (min and max)
   */
  private filterByLayover(
    results: FlightResultDto[],
    filters: FilterOptionsDto,
  ): FlightResultDto[] {
    if (
      filters.minLayoverMinutes === undefined &&
      filters.maxLayoverMinutes === undefined
    ) {
      return results;
    }

    return results.filter((flight) => {
      // Check outbound leg layovers
      if (!this.checkLayovers(flight.outboundLeg, filters)) {
        return false;
      }

      // Check return leg layovers if present
      if (flight.returnLeg && !this.checkLayovers(flight.returnLeg, filters)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Check if all layovers in a leg meet the filter criteria
   */
  private checkLayovers(leg: FlightLegDto, filters: FilterOptionsDto): boolean {
    for (const layover of leg.layovers) {
      if (
        filters.minLayoverMinutes !== undefined &&
        layover.durationMinutes < filters.minLayoverMinutes
      ) {
        return false;
      }

      if (
        filters.maxLayoverMinutes !== undefined &&
        layover.durationMinutes > filters.maxLayoverMinutes
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Filter by price range
   */
  private filterByPrice(
    results: FlightResultDto[],
    filters: FilterOptionsDto,
  ): FlightResultDto[] {
    if (
      filters.minPrice === undefined &&
      filters.maxPrice === undefined
    ) {
      return results;
    }

    return results.filter((flight) => {
      if (
        filters.minPrice !== undefined &&
        flight.lowestPrice < filters.minPrice
      ) {
        return false;
      }

      if (
        filters.maxPrice !== undefined &&
        flight.lowestPrice > filters.maxPrice
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * Filter by total trip duration
   */
  private filterByDuration(
    results: FlightResultDto[],
    filters: FilterOptionsDto,
  ): FlightResultDto[] {
    if (
      filters.minDurationMinutes === undefined &&
      filters.maxDurationMinutes === undefined
    ) {
      return results;
    }

    return results.filter((flight) => {
      // Use outbound leg duration for comparison (main flight)
      const duration = flight.outboundLeg.durationMinutes;

      if (
        filters.minDurationMinutes !== undefined &&
        duration < filters.minDurationMinutes
      ) {
        return false;
      }

      if (
        filters.maxDurationMinutes !== undefined &&
        duration > filters.maxDurationMinutes
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * Filter by airlines (include or exclude)
   */
  private filterByAirlines(
    results: FlightResultDto[],
    filters: FilterOptionsDto,
  ): FlightResultDto[] {
    // If no airline filters, return all results
    if (
      (!filters.airlines || filters.airlines.length === 0) &&
      (!filters.excludeAirlines || filters.excludeAirlines.length === 0)
    ) {
      return results;
    }

    return results.filter((flight) => {
      // Get all carrier codes from the flight
      const carrierCodes = this.getFlightCarrierCodes(flight);

      // If include filter is set, at least one carrier must be in the list
      if (filters.airlines && filters.airlines.length > 0) {
        const hasIncludedAirline = carrierCodes.some((code) =>
          filters.airlines!.includes(code),
        );
        if (!hasIncludedAirline) {
          return false;
        }
      }

      // If exclude filter is set, no carrier should be in the exclude list
      if (filters.excludeAirlines && filters.excludeAirlines.length > 0) {
        const hasExcludedAirline = carrierCodes.some((code) =>
          filters.excludeAirlines!.includes(code),
        );
        if (hasExcludedAirline) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Extract all unique carrier codes from a flight
   */
  private getFlightCarrierCodes(flight: FlightResultDto): string[] {
    const codes = new Set<string>();

    // From outbound leg
    for (const carrier of flight.outboundLeg.carriers) {
      codes.add(carrier.code);
    }

    // From return leg if present
    if (flight.returnLeg) {
      for (const carrier of flight.returnLeg.carriers) {
        codes.add(carrier.code);
      }
    }

    return Array.from(codes);
  }

  /**
   * Sort results by the specified option
   */
  private sortResults(
    results: FlightResultDto[],
    sortBy: SortOption,
  ): FlightResultDto[] {
    const sorted = [...results];

    switch (sortBy) {
      case 'price_asc':
        sorted.sort((a, b) => a.lowestPrice - b.lowestPrice);
        break;

      case 'price_desc':
        sorted.sort((a, b) => b.lowestPrice - a.lowestPrice);
        break;

      case 'duration_asc':
        sorted.sort(
          (a, b) =>
            a.outboundLeg.durationMinutes - b.outboundLeg.durationMinutes,
        );
        break;

      case 'duration_desc':
        sorted.sort(
          (a, b) =>
            b.outboundLeg.durationMinutes - a.outboundLeg.durationMinutes,
        );
        break;

      case 'departure_asc':
        sorted.sort(
          (a, b) =>
            new Date(a.outboundLeg.departureTime).getTime() -
            new Date(b.outboundLeg.departureTime).getTime(),
        );
        break;

      case 'departure_desc':
        sorted.sort(
          (a, b) =>
            new Date(b.outboundLeg.departureTime).getTime() -
            new Date(a.outboundLeg.departureTime).getTime(),
        );
        break;

      case 'stops_asc':
        sorted.sort((a, b) => a.outboundLeg.stopCount - b.outboundLeg.stopCount);
        break;
    }

    return sorted;
  }

  /**
   * Recalculate filter stats for filtered results
   * This keeps the original min/max from the full results but shows the filtered counts
   */
  private recalculateFilterStats(
    filteredResults: FlightResultDto[],
    originalResult: FlightSearchResultDto,
  ) {
    if (filteredResults.length === 0) {
      return originalResult.filterStats;
    }

    // Count airlines in filtered results
    const airlineCount = new Map<string, { name: string; count: number }>();
    for (const result of filteredResults) {
      for (const carrier of result.outboundLeg.carriers) {
        const existing = airlineCount.get(carrier.code);
        if (existing) {
          existing.count++;
        } else {
          airlineCount.set(carrier.code, { name: carrier.name, count: 1 });
        }
      }
    }

    // Count stops in filtered results
    const stopsCount = new Map<number, number>();
    for (const result of filteredResults) {
      const stops = result.outboundLeg.stopCount;
      stopsCount.set(stops, (stopsCount.get(stops) || 0) + 1);
    }

    return {
      // Keep original price/duration ranges for filter UI
      minPrice: originalResult.filterStats.minPrice,
      maxPrice: originalResult.filterStats.maxPrice,
      minDuration: originalResult.filterStats.minDuration,
      maxDuration: originalResult.filterStats.maxDuration,
      // Update counts based on filtered results
      airlines: Array.from(airlineCount.entries())
        .map(([code, data]) => ({ code, name: data.name, count: data.count }))
        .sort((a, b) => b.count - a.count),
      stopCounts: Array.from(stopsCount.entries())
        .map(([stops, count]) => ({ stops, count }))
        .sort((a, b) => a.stops - b.stops),
    };
  }
}
