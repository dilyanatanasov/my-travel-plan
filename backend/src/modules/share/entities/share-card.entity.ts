import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * The user's rendered share card, exactly one per user.
 *
 * user_id is the primary key on purpose: saving a new card is an in-place
 * replace, never an accumulation (user decision: no history). The row is a
 * PNG the browser rendered client-side via renderShareCard — the backend
 * only validates and stores it.
 */
@Entity('share_cards')
export class ShareCard {
  @PrimaryColumn({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'bytea' })
  image: Buffer;

  /** Pixel dimensions from the PNG's IHDR, reported as og:image:width/height. */
  @Column()
  width: number;

  @Column()
  height: number;

  /** Doubles as the ETag for GET /share/card/:token.png. */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
