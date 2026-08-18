import { DataSource } from 'typeorm';
import { seedCountries } from './countries.seed';
import { seedAirports } from './airports.seed';
import { seedCities } from './cities.seed';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'travel_tracker',
  // Every entity, by glob: the hand-picked list broke the moment an
  // entity in it referenced one outside it (FlightJourney#user).
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  // Schema is owned by migrations; a seeding run must never ALTER it.
  synchronize: false,
});

async function runSeeds() {
  try {
    await dataSource.initialize();
    console.log('Database connection established.');

    await seedCountries(dataSource);
    await seedAirports(dataSource);
    await seedCities(dataSource);

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

runSeeds();
