import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FlightLeg } from './flight-leg.entity';
import { User } from '../../users/entities/user.entity';

@Entity('flight_journeys')
export class FlightJourney {
  @PrimaryGeneratedColumn()
  id: number;

  // Nullable only so the auth migration could backfill pre-existing rows.
  // Every write path sets it; see AuthService.register() claim logic.
  @Column({ name: 'user_id', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, (user) => user.flightJourneys, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'journey_date', type: 'date', nullable: true })
  journeyDate: Date;

  /**
   * How much of journeyDate the user actually asserted. The date itself is
   * stored as the first day of the period ("2019" → 2019-01-01), so ordering
   * works unchanged; precision only drives display and the form.
   */
  @Column({ name: 'date_precision', type: 'varchar', length: 5, default: 'day' })
  datePrecision: 'day' | 'month' | 'year';

  @Column({ name: 'is_round_trip', type: 'boolean', default: false })
  isRoundTrip: boolean;

  /**
   * User-controlled tie-breaker for replay and list order: dated journeys
   * sort by (journeyDate, sortIndex), undated purely by sortIndex. Set to
   * the row's own id on insert; reordering swaps values between two rows.
   */
  @Column({ name: 'sort_index', type: 'integer', default: 0 })
  sortIndex: number;

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
