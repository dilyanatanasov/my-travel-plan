import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { User } from '../users/entities/user.entity';
import { Visit } from '../visits/entities/visit.entity';
import { FlightJourney } from '../flights/entities/flight-journey.entity';
import { Country } from '../countries/entities/country.entity';
import { ShareCard } from './entities/share-card.entity';
import {
  PublicMapDto,
  PublicAirportDto,
  PublicRouteDto,
} from './dto/public-map.dto';

/** First eight bytes of every PNG file. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Matches the express.raw limit in main.ts; a card is ~300 KB. */
const MAX_CARD_BYTES = 1024 * 1024;

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
    @InjectRepository(ShareCard)
    private readonly shareCardRepository: Repository<ShareCard>,
    private readonly configService: ConfigService,
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

  /**
   * Store the browser-rendered card, replacing whatever was there.
   *
   * The body arrives as a raw Buffer (express.raw in main.ts, image/png
   * only). Validated here rather than trusted: the magic bytes prove it is a
   * PNG, and width/height come from its IHDR — the first chunk, at fixed
   * offsets — so a crawler is never told dimensions the file does not have.
   */
  async saveCard(userId: number, body: unknown): Promise<{ ok: true }> {
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new BadRequestException(
        'Send the card as a raw PNG body with Content-Type: image/png',
      );
    }
    // express.raw already rejects oversized bodies with 413; this repeats the
    // cap so the service stays safe if the middleware wiring ever changes.
    if (body.length > MAX_CARD_BYTES) {
      throw new PayloadTooLargeException('The card must be 1 MB or smaller');
    }
    if (
      body.length < 24 ||
      !body.subarray(0, 8).equals(PNG_MAGIC) ||
      body.subarray(12, 16).toString('ascii') !== 'IHDR'
    ) {
      throw new BadRequestException('The uploaded file is not a PNG');
    }

    const width = body.readUInt32BE(16);
    const height = body.readUInt32BE(20);
    if (!width || !height) {
      throw new BadRequestException('The uploaded PNG is malformed');
    }

    // user_id is the primary key, so save() is the upsert-replace the plan
    // asks for: one card per user, no history.
    await this.shareCardRepository.save({ userId, image: body, width, height });
    return { ok: true };
  }

  /**
   * The stored card for a share token.
   *
   * Looked up via the token, never a user id, so revoking sharing kills the
   * preview image along with the map — same indistinguishable 404 for
   * "no such token", "revoked" and "no card yet".
   */
  async getCard(token: string): Promise<ShareCard> {
    const user = await this.userRepository.findOne({
      where: { shareToken: token },
    });
    const card = user
      ? await this.shareCardRepository.findOne({ where: { userId: user.id } })
      : null;
    if (!card) {
      throw new NotFoundException('This map is not available');
    }
    return card;
  }

  /**
   * Minimal HTML for link-preview crawlers, served to them by nginx's
   * UA-split on /s/<token>. Humans who land here anyway are met by the
   * meta-refresh to the real page.
   *
   * An unknown or revoked token gets the site's generic tags with a 200
   * rather than an error page: crawlers turn a 404 into "no preview at all",
   * and a dead link unfurling as the app beats a dead link unfurling as
   * nothing.
   */
  async getUnfurlHtml(token: string): Promise<string> {
    const app = this.appUrl();
    const user = await this.userRepository.findOne({
      where: { shareToken: token },
    });

    if (!user) {
      return this.unfurlHtml({
        title: 'myContrail',
        description:
          "You leave a trail. See it. Map every country you've been to, and every flight you've taken.",
        imageUrl: `${app}/og-image.png`,
        imageWidth: 1200,
        imageHeight: 630,
        pageUrl: app,
        redirectUrl: app,
      });
    }

    // Count the same way PublicMapDto does — trips and homes, not transits —
    // and only the count: notes and dates never appear in an unfurl (privacy
    // rule, same as the public map).
    const [countriesVisited, card] = await Promise.all([
      this.visitRepository.count({
        where: { userId: user.id, visitType: In(['trip', 'home']) },
      }),
      this.shareCardRepository.findOne({
        where: { userId: user.id },
        // The image itself is not needed here; skip pulling ~300 KB.
        select: { userId: true, width: true, height: true, updatedAt: true },
      }),
    ]);

    const name = user.displayName ? `${user.displayName}'s` : 'My';
    const noun = countriesVisited === 1 ? 'country' : 'countries';
    const pageUrl = `${app}/s/${encodeURIComponent(token)}`;

    return this.unfurlHtml({
      title: `${name} travel map — ${countriesVisited} ${noun}`,
      description:
        'Countries visited and flights flown, on one interactive world map. Made with myContrail.',
      // ?v= busts crawler image caches: the card URL never changes (one card
      // per user, replaced in place) but its content does on regenerate.
      imageUrl: card
        ? `${app}/api/share/card/${encodeURIComponent(token)}.png?v=${card.updatedAt.getTime()}`
        : `${app}/og-image.png`,
      imageWidth: card?.width ?? 1200,
      imageHeight: card?.height ?? 630,
      pageUrl,
      redirectUrl: pageUrl,
    });
  }

  /** Base URL for absolute OG URLs — same DOMAIN-derived pattern as MailService. */
  private appUrl(): string {
    const domain = this.configService.get<string>('DOMAIN');
    return domain ? `https://${domain}` : 'http://localhost:5173';
  }

  /** displayName is user-written free text; it must not become markup. */
  private escapeHtml(value: string): string {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return value.replace(/[&<>"']/g, (char) => entities[char]);
  }

  private unfurlHtml(meta: {
    title: string;
    description: string;
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
    pageUrl: string;
    redirectUrl: string;
  }): string {
    const title = this.escapeHtml(meta.title);
    const description = this.escapeHtml(meta.description);
    const imageUrl = this.escapeHtml(meta.imageUrl);
    const pageUrl = this.escapeHtml(meta.pageUrl);
    const redirectUrl = this.escapeHtml(meta.redirectUrl);

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="myContrail">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${imageUrl}">
<meta property="og:image:width" content="${meta.imageWidth}">
<meta property="og:image:height" content="${meta.imageHeight}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${imageUrl}">
<meta http-equiv="refresh" content="0;url=${redirectUrl}">
</head>
<body>
<p><a href="${redirectUrl}">${title}</a></p>
</body>
</html>
`;
  }
}
