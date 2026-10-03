import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { AuthService } from './auth.service';
import { AuthTokensService } from './auth-tokens.service';
import { GuestCleanupService } from './guest-cleanup.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { AuthToken } from './entities/auth-token.entity';
import { UserIdentity } from './entities/user-identity.entity';
import { GoogleAuthService } from './google-auth.service';

@Module({
  imports: [
    UsersModule,
    MailModule,
    TypeOrmModule.forFeature([AuthToken, UserIdentity]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          // Cast: jsonwebtoken types this as a `ms` template literal union,
          // which a runtime config string cannot satisfy statically.
          expiresIn: configService.get<string>(
            'JWT_EXPIRES_IN',
            '7d',
          ) as SignOptions['expiresIn'],
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    GuestCleanupService,
    AuthService,
    AuthTokensService,
    GoogleAuthService,
    JwtStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
