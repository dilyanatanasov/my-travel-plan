import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type AuthTokenType = 'verify' | 'reset';

/**
 * Single-use, expiring tokens for email verification and password reset.
 *
 * Only the SHA-256 of the token is stored — the raw value exists once, inside
 * the emailed link. Redemption marks `usedAt` rather than deleting, so an
 * attempted replay is distinguishable from a token that never existed.
 */
@Entity('auth_tokens')
@Index('IDX_auth_tokens_user_type', ['userId', 'type'])
export class AuthToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 10 })
  type: AuthTokenType;

  @Index('IDX_auth_tokens_hash')
  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamp', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
