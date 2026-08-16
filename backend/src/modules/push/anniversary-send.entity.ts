import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';

@Entity('anniversary_sends')
@Unique('uq_anniversary_once', ['userId', 'journeyId', 'year'])
export class AnniversarySend {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'journey_id' })
  journeyId: number;

  /** The calendar year the notification went out, not the trip's year. */
  @Column()
  year: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
