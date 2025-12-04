import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { FlightLeg } from './flight-leg.entity';

@Entity('flight_journeys')
export class FlightJourney {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'journey_date', type: 'date', nullable: true })
  journeyDate: Date;

  @Column({ name: 'is_round_trip', type: 'boolean', default: false })
  isRoundTrip: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(() => FlightLeg, (leg) => leg.journey, {
    cascade: true,
    eager: true,
  })
  legs: FlightLeg[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Virtual property: total distance of all legs
  get totalDistanceKm(): number {
    if (!this.legs) return 0;
    return this.legs.reduce((sum, leg) => sum + Number(leg.distanceKm || 0), 0);
  }
}
