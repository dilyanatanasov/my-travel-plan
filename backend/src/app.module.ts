import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CountriesModule } from './modules/countries/countries.module';
import { VisitsModule } from './modules/visits/visits.module';
import { AirportsModule } from './modules/airports/airports.module';
import { FlightsModule } from './modules/flights/flights.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'postgres'),
        database: configService.get('DB_DATABASE', 'travel_tracker'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        // Schema is owned by migrations (see src/migrations, src/data-source.ts).
        // Leaving synchronize on would fight them and could drop columns.
        synchronize: false,
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    // Generous global ceiling; auth endpoints tighten this with @Throttle.
    // The map legitimately fires many rapid requests when toggling countries.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    CountriesModule,
    VisitsModule,
    AirportsModule,
    FlightsModule,
    UsersModule,
    AuthModule,
  ],
  providers: [
    // Deny by default: every endpoint requires auth unless marked @Public().
    // Opt-in guards would leave each new endpoint unprotected by omission.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
