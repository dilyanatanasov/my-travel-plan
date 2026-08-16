import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

/**
 * One observed price for a route+date, from any provider. Append-only:
 * history is the point — medians, trends and watch triggers all want to
 * know what a route USED to cost.
 */
@Entity('price_observations')
@Index('idx_obs_route_date', ['origin', 'destination', 'departureDate'])
@Index('idx_obs_route_seen', ['origin', 'destination', 'observedAt'])
export class PriceObservation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 3 })
  origin: string;

  @Column({ length: 3 })
  destination: string;

  @Column({ name: 'departure_date', type: 'date' })
  departureDate: string;

  @Column({ name: 'return_date', type: 'date', nullable: true })
  returnDate: string | null;

  @Column({ type: 'integer', nullable: true })
  nights: number | null;

  @Column({ name: 'total_price', type: 'numeric', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ length: 16 })
  provider: string;

  @Column({ length: 20, default: 'economy' })
  cabin: string;

  @Column({ default: 1 })
  passengers: number;

  /** Aggregated/cached numbers are estimates; live quotes are not. */
  @Column({ name: 'is_estimate', default: true })
  isEstimate: boolean;

  @Column({ name: 'observed_at', type: 'timestamp', default: () => 'now()' })
  observedAt: Date;
}
