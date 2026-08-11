import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { hash, verify } from '@node-rs/argon2';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt.strategy';

export interface PublicUser {
  id: number;
  /** Null for a guest, which is how the client knows to show the save prompt. */
  email: string | null;
  displayName: string | null;
  isGuest: boolean;
  createdAt: Date;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  /** Number of pre-existing rows adopted by the first account, if any. */
  claimed?: { visits: number; flightJourneys: number };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      isGuest: user.isGuest,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    };
  }

  private issueToken(user: User): string {
    // email is null for guests; the subject id is what identifies the row.
    const payload: JwtPayload = { sub: user.id, email: user.email ?? undefined };
    return this.jwtService.sign(payload);
  }

  /**
   * Start an anonymous session.
   *
   * A real row, so every scoped query and guard works untouched, and so
   * registering later can upgrade this same row instead of migrating data
   * between two accounts.
   */
  async createGuest(): Promise<AuthResult> {
    const user = await this.userRepository.save(
      this.userRepository.create({
        email: null,
        passwordHash: null,
        displayName: null,
        isGuest: true,
      }),
    );

    return { user: this.toPublicUser(user), accessToken: this.issueToken(user) };
  }

  /**
   * Best-effort user id from a token.
   *
   * /auth/register is @Public, so the guard never populates req.user even
   * when a valid guest cookie is present — without this the upgrade path
   * could never fire and every guest who signed up would be orphaned from
   * their own data. Returns undefined for anything invalid or absent.
   */
  userIdFromToken(token?: string): number | undefined {
    if (!token) return undefined;
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      return typeof payload?.sub === 'number' ? payload.sub : undefined;
    } catch {
      return undefined;
    }
  }

  /** Keeps the cleanup sweep from collecting an account still in use. */
  async touch(userId: number): Promise<void> {
    await this.userRepository.update({ id: userId }, { lastSeenAt: new Date() });
  }

  /**
   * Create an account, or upgrade the guest session making the request.
   *
   * If this is the very first account it also adopts pre-existing travel data
   * (rows written before auth existed, with user_id IS NULL), in the same
   * transaction so a partial claim is impossible.
   */
  async register(dto: RegisterDto, guestUserId?: number): Promise<AuthResult> {
    if (await this.usersService.emailExists(dto.email)) {
      throw new ConflictException('An account with that email already exists');
    }

    const passwordHash = await hash(dto.password);

    return this.dataSource.transaction(async (manager) => {
      /*
        Signing up from a guest session converts that row rather than creating
        a new one. Everything the guest built is already attached to this id,
        so there is nothing to copy and nothing that can be dropped in
        transit.
      */
      if (guestUserId !== undefined) {
        const guest = await manager.findOne(User, {
          where: { id: guestUserId, isGuest: true },
        });
        if (guest) {
          guest.email = dto.email.trim().toLowerCase();
          guest.passwordHash = passwordHash;
          guest.displayName = dto.displayName || null;
          guest.isGuest = false;
          const upgraded = await manager.save(guest);
          return {
            user: this.toPublicUser(upgraded),
            accessToken: this.issueToken(upgraded),
          };
        }
      }

      const isFirstUser = (await manager.count(User)) === 0;

      let user: User;
      try {
        user = await manager.save(
          manager.create(User, {
            email: dto.email.trim().toLowerCase(),
            passwordHash,
            displayName: dto.displayName || null,
          }),
        );
      } catch (err: any) {
        // Unique violation — someone registered the same email concurrently.
        if (err?.code === '23505') {
          throw new ConflictException(
            'An account with that email already exists',
          );
        }
        throw err;
      }

      let claimed: AuthResult['claimed'];
      if (isFirstUser) {
        const visitsResult = await manager.query(
          `UPDATE visits SET user_id = $1 WHERE user_id IS NULL`,
          [user.id],
        );
        const journeysResult = await manager.query(
          `UPDATE flight_journeys SET user_id = $1 WHERE user_id IS NULL`,
          [user.id],
        );

        // node-postgres returns [rows, rowCount] for UPDATE via query()
        claimed = {
          visits: Number(visitsResult?.[1] ?? 0),
          flightJourneys: Number(journeysResult?.[1] ?? 0),
        };

        if (claimed.visits > 0 || claimed.flightJourneys > 0) {
          this.logger.log(
            `First account ${user.email} claimed ${claimed.visits} visits ` +
              `and ${claimed.flightJourneys} flight journeys`,
          );
        }
      }

      return {
        user: this.toPublicUser(user),
        accessToken: this.issueToken(user),
        claimed,
      };
    });
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);

    // Same message for "no such user" and "wrong password" so this endpoint
    // is not a user-enumeration oracle.
    const invalid = () =>
      new UnauthorizedException('Incorrect email or password');

    if (!user || !user.passwordHash) {
      // Hash anyway so a missing account is not detectably faster than a
      // wrong password. A guest row has no hash and can never be logged into.
      await hash(dto.password).catch(() => undefined);
      throw invalid();
    }

    let passwordMatches = false;
    try {
      passwordMatches = await verify(user.passwordHash, dto.password);
    } catch {
      passwordMatches = false;
    }

    if (!passwordMatches) {
      throw invalid();
    }

    return {
      user: this.toPublicUser(user),
      accessToken: this.issueToken(user),
    };
  }

  async getProfile(userId: number): Promise<PublicUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.toPublicUser(user);
  }
}
