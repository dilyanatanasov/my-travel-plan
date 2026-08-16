import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('trip_watches')
@Unique('uq_watch_route', ['userId', 'origin', 'destination', 'month'])
export class TripWatch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 3 })
  origin: string;

  @Column({ length: 3 })
  destination: string;

  /** YYYY-MM, the funnel's own unit of interest. */
  @Column({ length: 7 })
  month: string;

  @Column({ name: 'min_nights', type: 'integer', nullable: true })
  minNights: number | null;

  @Column({ name: 'max_nights', type: 'integer', nullable: true })
  maxNights: number | null;

  /** Alert when the best price dips under this; null = trend rule only. */
  @Column({
    name: 'threshold_price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  thresholdPrice: number | null;

  @Column({
    name: 'last_notified_price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  lastNotifiedPrice: number | null;

  @Column({ name: 'last_notified_at', type: 'timestamp', nullable: true })
  lastNotifiedAt: Date | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
