import { DataSource } from 'typeorm';
import { Country } from '../modules/countries/entities/country.entity';
import { Visit } from '../modules/visits/entities/visit.entity';
import { Airport } from '../modules/airports/entities/airport.entity';
import { FlightJourney } from '../modules/flights/entities/flight-journey.entity';
import { FlightLeg } from '../modules/flights/entities/flight-leg.entity';
import { seedCountries } from './countries.seed';
import { seedAirports } from './airports.seed';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'travel_tracker',
  entities: [Country, Visit, Airport, FlightJourney, FlightLeg],
  synchronize: true,
});

async function runSeeds() {
  try {
    await dataSource.initialize();
    console.log('Database connection established.');

    await seedCountries(dataSource);
    await seedAirports(dataSource);

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

runSeeds();
