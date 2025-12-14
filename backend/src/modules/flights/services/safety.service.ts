import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BannedAirline, BanType } from '../entities/banned-airline.entity';
import { SafetyWarning } from '../dto/flight-result.dto';
import * as bannedAirlinesData from '../data/eu-banned-airlines.json';

export interface SafetyCheckResult {
  warning: SafetyWarning;
  reason?: string;
  banType?: BanType;
  source?: string;
}

@Injectable()
export class SafetyService implements OnModuleInit {
  private readonly logger = new Logger(SafetyService.name);

  // In-memory cache for quick lookups
  private bannedByIata: Map<string, BannedAirline> = new Map();
  private bannedByIcao: Map<string, BannedAirline> = new Map();
  private bannedByName: Map<string, BannedAirline> = new Map();

  constructor(
    @InjectRepository(BannedAirline)
    private readonly bannedAirlineRepository: Repository<BannedAirline>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedBannedAirlines();
    await this.loadBannedAirlinesCache();
  }

  /**
   * Seeds the database with EU Air Safety List data if empty
   */
  private async seedBannedAirlines(): Promise<void> {
    const count = await this.bannedAirlineRepository.count();

    if (count > 0) {
      this.logger.log(
        `Banned airlines table already has ${count} entries, skipping seed`,
      );
      return;
    }

    this.logger.log('Seeding banned airlines from EU Air Safety List...');

    const airlines = bannedAirlinesData.bannedAirlines;
    const entities: Partial<BannedAirline>[] = airlines.map((airline) => ({
      iataCode: airline.iataCode,
      icaoCode: airline.icaoCode,
      name: airline.name,
      country: airline.country,
      source: 'EU_AIR_SAFETY_LIST' as const,
      banType: airline.banType as BanType,
      reason: airline.reason,
    }));

    await this.bannedAirlineRepository.save(entities);
    this.logger.log(`Seeded ${entities.length} banned airlines`);
  }

  /**
   * Loads banned airlines into memory cache for fast lookups
   */
  private async loadBannedAirlinesCache(): Promise<void> {
    const bannedAirlines = await this.bannedAirlineRepository.find();

    this.bannedByIata.clear();
    this.bannedByIcao.clear();
    this.bannedByName.clear();

    for (const airline of bannedAirlines) {
      if (airline.iataCode) {
        this.bannedByIata.set(airline.iataCode.toUpperCase(), airline);
      }
      if (airline.icaoCode) {
        this.bannedByIcao.set(airline.icaoCode.toUpperCase(), airline);
      }
      // Store normalized name for fuzzy matching
      this.bannedByName.set(this.normalizeName(airline.name), airline);
    }

    this.logger.log(
      `Loaded ${bannedAirlines.length} banned airlines into cache`,
    );
  }

  /**
   * Checks if an airline is on the banned list
   * @param iataCode - IATA airline code (2 letters)
   * @param icaoCode - ICAO airline code (3 letters)
   * @param name - Airline name
   * @returns Safety check result
   */
  checkAirlineSafety(
    iataCode?: string,
    icaoCode?: string,
    name?: string,
  ): SafetyCheckResult {
    // Check by IATA code first (most common identifier)
    if (iataCode) {
      const banned = this.bannedByIata.get(iataCode.toUpperCase());
      if (banned) {
        return this.createSafetyResult(banned);
      }
    }

    // Check by ICAO code
    if (icaoCode) {
      const banned = this.bannedByIcao.get(icaoCode.toUpperCase());
      if (banned) {
        return this.createSafetyResult(banned);
      }
    }

    // Check by name (fuzzy match)
    if (name) {
      const normalizedName = this.normalizeName(name);
      const banned = this.bannedByName.get(normalizedName);
      if (banned) {
        return this.createSafetyResult(banned);
      }

      // Partial name matching for variations
      for (const [storedName, airline] of this.bannedByName.entries()) {
        if (
          normalizedName.includes(storedName) ||
          storedName.includes(normalizedName)
        ) {
          return this.createSafetyResult(airline);
        }
      }
    }

    return { warning: 'safe' };
  }

  /**
   * Checks multiple airlines at once
   * @param carriers - Array of carrier info objects
   * @returns Map of carrier code to safety result
   */
  checkMultipleAirlines(
    carriers: Array<{ code?: string; name?: string }>,
  ): Map<string, SafetyCheckResult> {
    const results = new Map<string, SafetyCheckResult>();

    for (const carrier of carriers) {
      const key = carrier.code || carrier.name || 'unknown';
      if (!results.has(key)) {
        results.set(key, this.checkAirlineSafety(carrier.code, undefined, carrier.name));
      }
    }

    return results;
  }

  /**
   * Gets all banned airlines
   */
  async getAllBannedAirlines(): Promise<BannedAirline[]> {
    return this.bannedAirlineRepository.find({
      order: { country: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Refreshes the in-memory cache from the database
   */
  async refreshCache(): Promise<void> {
    await this.loadBannedAirlinesCache();
  }

  /**
   * Adds a new banned airline to the database
   */
  async addBannedAirline(data: Partial<BannedAirline>): Promise<BannedAirline> {
    const airline = this.bannedAirlineRepository.create(data);
    const saved = await this.bannedAirlineRepository.save(airline);
    await this.refreshCache();
    return saved;
  }

  /**
   * Removes a banned airline from the database
   */
  async removeBannedAirline(id: number): Promise<void> {
    await this.bannedAirlineRepository.delete(id);
    await this.refreshCache();
  }

  private createSafetyResult(airline: BannedAirline): SafetyCheckResult {
    // Partial bans get 'caution', full bans get 'banned'
    const warning: SafetyWarning =
      airline.banType === 'partial' ? 'caution' : 'banned';

    return {
      warning,
      reason: airline.reason || undefined,
      banType: airline.banType,
      source: airline.source,
    };
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+(airlines?|airways?|air|aviation|express|international)\s*/gi, ' ')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
