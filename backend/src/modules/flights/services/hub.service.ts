import { Injectable, Logger } from '@nestjs/common';
import { Hub, KNOWN_HUBS, getHubsForDestination, getDefaultHubs } from '../data/hubs';

@Injectable()
export class HubService {
  private readonly logger = new Logger(HubService.name);

  /**
   * Get relevant hubs for a given origin-destination pair.
   * Returns hubs sorted by priority.
   */
  getRelevantHubs(
    origin: string,
    destination: string,
    preferredHubs?: string[],
    excludedHubs?: string[],
    maxHubs: number = 5,
  ): Hub[] {
    // Get hubs based on destination
    let hubs = getHubsForDestination(destination);

    // If no specific hubs found, use defaults
    if (hubs.length === 0) {
      hubs = getDefaultHubs();
    }

    // Filter out origin and destination (can't connect through ourselves)
    hubs = hubs.filter(h => h.code !== origin && h.code !== destination);

    // Apply user preferences
    if (preferredHubs && preferredHubs.length > 0) {
      // Boost preferred hubs to the top
      const preferred = hubs.filter(h => preferredHubs.includes(h.code));
      const others = hubs.filter(h => !preferredHubs.includes(h.code));
      hubs = [...preferred, ...others];
    }

    if (excludedHubs && excludedHubs.length > 0) {
      hubs = hubs.filter(h => !excludedHubs.includes(h.code));
    }

    // Limit number of hubs to search
    hubs = hubs.slice(0, maxHubs);

    this.logger.log(
      `Selected ${hubs.length} hubs for ${origin} -> ${destination}: ${hubs.map(h => h.code).join(', ')}`,
    );

    return hubs;
  }

  /**
   * Get all known hubs (for UI display).
   */
  getAllHubs(): Hub[] {
    return KNOWN_HUBS;
  }

  /**
   * Get a hub by code.
   */
  getHubByCode(code: string): Hub | null {
    return KNOWN_HUBS.find(h => h.code === code) || null;
  }

  /**
   * Calculate if a connection is feasible based on times.
   * Returns true if there's enough time between arrival and departure.
   */
  isConnectionFeasible(
    arrivalTime: string,
    departureTime: string,
    hubCode: string,
  ): boolean {
    const hub = this.getHubByCode(hubCode);
    const minConnection = hub?.minConnectionMinutes || 60;

    const arrival = new Date(arrivalTime);
    const departure = new Date(departureTime);
    const connectionMinutes = (departure.getTime() - arrival.getTime()) / (1000 * 60);

    // Connection must be at least minConnection and less than 12 hours
    return connectionMinutes >= minConnection && connectionMinutes <= 720;
  }

  /**
   * Calculate connection quality score (0-100).
   * Higher is better.
   */
  scoreConnection(
    arrivalTime: string,
    departureTime: string,
    hubCode: string,
  ): number {
    const hub = this.getHubByCode(hubCode);
    const minConnection = hub?.minConnectionMinutes || 60;

    const arrival = new Date(arrivalTime);
    const departure = new Date(departureTime);
    const connectionMinutes = (departure.getTime() - arrival.getTime()) / (1000 * 60);

    if (connectionMinutes < minConnection) {
      return 0; // Too short
    }

    if (connectionMinutes <= 120) {
      return 100; // Ideal: 1-2 hours
    }

    if (connectionMinutes <= 180) {
      return 90; // Good: 2-3 hours
    }

    if (connectionMinutes <= 300) {
      return 70; // Acceptable: 3-5 hours
    }

    if (connectionMinutes <= 480) {
      return 50; // Long: 5-8 hours
    }

    if (connectionMinutes <= 720) {
      return 30; // Very long: 8-12 hours
    }

    return 0; // Too long (>12 hours)
  }
}
