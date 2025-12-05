import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Country } from '../../countries/entities/country.entity';
import { FlightJourney } from '../../flights/entities/flight-journey.entity';

export type VisitType = 'trip' | 'transit' | 'home';
export type VisitSource = 'manual' | 'flight';

@Entity('visits')
export class Visit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'country_id' })
  countryId: number;

  @ManyToOne(() => Country, (country) => country.visits)
  @JoinColumn({ name: 'country_id' })
  country: Country;

  @Column({ name: 'visited_at', type: 'date', nullable: true })
  visitedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({
    name: 'visit_type',
    type: 'varchar',
    length: 20,
    default: 'trip',
  })
  visitType: VisitType;

  @Column({
    name: 'source',
    type: 'varchar',
    length: 20,
    default: 'manual',
  })
  source: VisitSource;

  @Column({ name: 'flight_journey_id', nullable: true })
  flightJourneyId: number | null;

  @ManyToOne(() => FlightJourney, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'flight_journey_id' })
  flightJourney: FlightJourney | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
