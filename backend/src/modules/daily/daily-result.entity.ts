import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/entities/user.entity';

@Entity('daily_results')
@Unique('uq_daily_user_date', ['userId', 'date'])
export class DailyResult {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** The puzzle's UTC day, YYYY-MM-DD. */
  @Column({ type: 'date' })
  date: string;

  @Column()
  won: boolean;

  @Column()
  tries: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
