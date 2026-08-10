import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { hash, verify } from '@node-rs/argon2';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt.strategy';

export interface PublicUser {
  id: number;
  email: string;
  displayName: string | null;
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
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    };
  }

  private issueToken(user: User): string {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return this.jwtService.sign(payload);
  }

  /**
   * Create an account.
   *
   * If this is the very first account, it adopts any pre-existing travel data
   * (rows written before auth existed, which have user_id IS NULL). The whole
   * thing runs in one transaction so a partial claim is impossible.
   */
  async register(dto: RegisterDto): Promise<AuthResult> {
    if (await this.usersService.emailExists(dto.email)) {
      throw new ConflictException('An account with that email already exists');
    }

    const passwordHash = await hash(dto.password);

    return this.dataSource.transaction(async (manager) => {
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

    if (!user) {
      // Hash anyway so a missing account is not detectably faster than a
      // wrong password.
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
