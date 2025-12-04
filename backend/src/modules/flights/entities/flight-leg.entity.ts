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

  @Column({ name: 'departure_airport_id' })
  departureAirportId: number;

  @ManyToOne(() => Airport, { eager: true })
  @JoinColumn({ name: 'departure_airport_id' })
  departureAirport: Airport;

  @Column({ name: 'arrival_airport_id' })
  arrivalAirportId: number;

  @ManyToOne(() => Airport, { eager: true })
  @JoinColumn({ name: 'arrival_airport_id' })
  arrivalAirport: Airport;

  @Column({ name: 'distance_km', type: 'decimal', precision: 10, scale: 2 })
  distanceKm: number;
}
