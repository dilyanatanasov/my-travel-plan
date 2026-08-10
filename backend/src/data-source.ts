import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Loaded for CLI use only; the Nest app gets config via ConfigModule.
config();

/**
 * DataSource used by the TypeORM CLI for migrations.
 *
 * Note DB_HOST defaults to 'localhost' here rather than 'db' — when running
 * migrations from the host you talk to the published port, and when running
 * them inside the backend container DB_HOST is already set to 'db' by compose.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'travel_tracker',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsTableName: 'migrations',
  synchronize: false,
});

// Deliberately no default export — the TypeORM CLI rejects a file that
// exports more than one DataSource instance.
