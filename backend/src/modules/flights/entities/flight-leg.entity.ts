import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { FlightJourney } from './flight-journey.entity';
import { Airport } from '../../airports/entities/airport.entity';
import { City } from '../../cities/entities/city.entity';

/**
 * How a leg was travelled. 'flight' between airports; the land modes
 * between cities ("Varna to Plovdiv by train", 2026-08-17). 'ferry' is in
 * the schema so a later mode needs no migration; the UI does not offer it
 * yet. Each endpoint is exactly one of airport or city - a DB CHECK
 * enforces it (migration 1787600000000).
 */
export type TravelMode = 'flight' | 'train' | 'car' | 'bus' | 'ferry';

@Entity('flight_legs')
@Unique(['journey', 'legOrder'])
export class FlightLeg {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'journey_id' })
  journeyId: number;

  @ManyToOne(() => FlightJourney, (journey) => journey.legs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'journey_id' })
  journey: FlightJourney;

  @Column({ name: 'leg_order' })
  legOrder: number;

  @Column({ name: 'travel_mode', length: 10, default: 'flight' })
  travelMode: TravelMode;

  @Column({ name: 'departure_airport_id', nullable: true })
  departureAirportId: number | null;

  @ManyToOne(() => Airport, { eager: true, nullable: true })
  @JoinColumn({ name: 'departure_airport_id' })
  departureAirport: Airport | null;

  @Column({ name: 'arrival_airport_id', nullable: true })
  arrivalAirportId: number | null;

  @ManyToOne(() => Airport, { eager: true, nullable: true })
  @JoinColumn({ name: 'arrival_airport_id' })
  arrivalAirport: Airport | null;

  @Column({ name: 'departure_city_id', nullable: true })
  departureCityId: number | null;

  @ManyToOne(() => City, { eager: true, nullable: true })
  @JoinColumn({ name: 'departure_city_id' })
  departureCity: City | null;

  @Column({ name: 'arrival_city_id', nullable: true })
  arrivalCityId: number | null;

  @ManyToOne(() => City, { eager: true, nullable: true })
  @JoinColumn({ name: 'arrival_city_id' })
  arrivalCity: City | null;

  @Column({ name: 'distance_km', type: 'decimal', precision: 10, scale: 2 })
  distanceKm: number;
}
