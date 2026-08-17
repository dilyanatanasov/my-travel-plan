import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { CountriesModule } from './modules/countries/countries.module';
import { VisitsModule } from './modules/visits/visits.module';
import { AirportsModule } from './modules/airports/airports.module';
import { CitiesModule } from './modules/cities/cities.module';
import { FlightsModule } from './modules/flights/flights.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ShareModule } from './modules/share/share.module';
import { DailyModule } from './modules/daily/daily.module';
import { PushModule } from './modules/push/push.module';
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
    // Two buckets, both applied globally by the ThrottlerGuard:
    //  - 'default' is the generous per-minute ceiling; the map legitimately
    //    fires many rapid requests when toggling countries, and per-route
    //    @Throttle({ default: … }) tightens it on auth and search endpoints.
    //  - 'burst' caps a single client's short spikes so it cannot spend the
    //    whole minute's budget in one second (a scripted hammer), while
    //    staying well above real human interaction. Provisional value pending
    //    the map's measured burst rate in the performance pass.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 300 },
      { name: 'burst', ttl: 10_000, limit: 100 },
    ]),
    // Drives the guest-cleanup interval and the anniversary cron.
    ScheduleModule.forRoot(),
    CountriesModule,
    VisitsModule,
    AirportsModule,
    CitiesModule,
    FlightsModule,
    UsersModule,
    AuthModule,
    ShareModule,
    DailyModule,
    PushModule,
  ],
  providers: [
    // Deny by default: every endpoint requires auth unless marked @Public().
    // Opt-in guards would leave each new endpoint unprotected by omission.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
