import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { User } from '../users/entities/user.entity';
import { Visit } from '../visits/entities/visit.entity';
import { FlightJourney } from '../flights/entities/flight-journey.entity';
import { Country } from '../countries/entities/country.entity';
import {
  PublicMapDto,
  PublicAirportDto,
  PublicRouteDto,
} from './dto/public-map.dto';

@Injectable()
export class ShareService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Visit)
    private readonly visitRepository: Repository<Visit>,
    @InjectRepository(FlightJourney)
    private readonly journeyRepository: Repository<FlightJourney>,
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
  ) {}

  /** 16 URL-safe characters — long enough that tokens are not enumerable. */
  private generateToken(): string {
    return randomBytes(12).toString('base64url').slice(0, 16);
  }

  async getStatus(userId: number): Promise<{ shareToken: string | null }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return { shareToken: user?.shareToken ?? null };
  }

  /** Idempotent: returns the existing token rather than rotating it. */
  async enable(userId: number): Promise<{ shareToken: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    // The register-spam defense: publishing a public link is the one thing
    // an unverified account cannot do. The code is what the frontend keys
    // on to show the verify prompt instead of a generic error.
    if (!user.emailVerified) {
      throw new ForbiddenException({
        code: 'EMAIL_UNVERIFIED',
        message: 'Verify your email to share your map',
      });
    }
    if (!user.shareToken) {
      user.shareToken = this.generateToken();
      await this.userRepository.save(user);
    }
    return { shareToken: user.shareToken };
  }

  /** Clearing the token immediately breaks every link already handed out. */
  async disable(userId: number): Promise<{ shareToken: null }> {
    await this.userRepository.update({ id: userId }, { shareToken: null });
    return { shareToken: null };
  }

  async getPublicMap(token: string): Promise<PublicMapDto> {
    const user = await this.userRepository.findOne({
      where: { shareToken: token },
    });
    // Same response for "no such token" and "revoked" — neither should be
    // distinguishable from outside.
    if (!user) {
      throw new NotFoundException('This map is not available');
    }

    const [visits, journeys, totalCountries] = await Promise.all([
      this.visitRepository.find({
        where: { userId: user.id },
        relations: ['country'],
      }),
      this.journeyRepository.find({
        where: { userId: user.id },
        relations: ['legs', 'legs.departureAirport', 'legs.arrivalAirport'],
      }),
      this.countryRepository.count(),
    ]);

    const countries = visits
      .filter((visit) => visit.country)
      .map((visit) => ({
        isoCode: visit.country.isoCode,
        isoCode2: visit.country.isoCode2,
        name: visit.country.name,
        visitType: visit.visitType || 'trip',
      }));

    // Aggregate legs into undirected routes so an out-and-back counts as one
    // line drawn twice as thick, matching the authenticated map.
    const routeMap = new Map<string, PublicRouteDto>();
    const airportMap = new Map<string, PublicAirportDto>();
    let flights = 0;
    let distanceKm = 0;

    const toPublicAirport = (airport: {
      iataCode: string;
      city: string | null;
      latitude: number | string;
      longitude: number | string;
    }): PublicAirportDto => ({
      iataCode: airport.iataCode,
      city: airport.city,
      latitude: Number(airport.latitude),
      longitude: Number(airport.longitude),
    });

    for (const journey of journeys) {
      for (const leg of journey.legs ?? []) {
        if (!leg.departureAirport || !leg.arrivalAirport) continue;

        flights += 1;
        distanceKm += Number(leg.distanceKm) || 0;

        const from = toPublicAirport(leg.departureAirport);
        const to = toPublicAirport(leg.arrivalAirport);
        airportMap.set(from.iataCode, from);
        airportMap.set(to.iataCode, to);

        const legDistance = Number(leg.distanceKm) || 0;
        const key = [from.iataCode, to.iataCode].sort().join('-');
        const existing = routeMap.get(key);
        if (existing) {
          existing.count += 1;
          existing.distanceKm += legDistance;
        } else {
          routeMap.set(key, { from, to, count: 1, distanceKm: legDistance });
        }
      }
    }

    const countriesVisited = visits.filter((visit) => {
      const type = visit.visitType || 'trip';
      return type === 'trip' || type === 'home';
    }).length;

    return {
      displayName: user.displayName || 'A traveller',
      countries,
      airports: [...airportMap.values()],
      routes: [...routeMap.values()],
      stats: {
        countriesVisited,
        transitCount: visits.filter((v) => v.visitType === 'transit').length,
        totalCountries,
        worldPercent:
          totalCountries > 0
            ? Math.round((countriesVisited / totalCountries) * 1000) / 10
            : 0,
        journeys: journeys.length,
        flights,
        distanceKm: Math.round(distanceKm),
      },
    };
  }
}
