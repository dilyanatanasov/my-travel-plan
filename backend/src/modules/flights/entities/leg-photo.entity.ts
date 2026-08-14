import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FlightLeg } from './flight-leg.entity';
import { User } from '../../users/entities/user.entity';

/**
 * One photo per stop (UNIQUE leg_id — the schema is the cap; re-upload
 * replaces). The row points at a compressed file on the uploads volume;
 * user_id is denormalized so serving checks ownership in one lookup.
 */
@Entity('leg_photos')
export class LegPhoto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'leg_id', unique: true })
  legId: number;

  @ManyToOne(() => FlightLeg, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'leg_id' })
  leg: FlightLeg;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 64 })
  filename: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
