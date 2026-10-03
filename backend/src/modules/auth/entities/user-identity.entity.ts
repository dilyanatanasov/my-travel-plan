import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * A sign-in method from an outside provider (2026-10-03: Google).
 *
 * One row per (provider, subject): the subject is the provider's stable id
 * for the person, never the email, because emails change and a provider
 * may even reassign one. A user can hold several identities, and an
 * account with no password at all is a normal state - it signs in through
 * these rows.
 */
@Entity('user_identities')
@Unique(['provider', 'providerSubject'])
export class UserIdentity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, (user) => user.identities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20 })
  provider: string;

  @Column({ name: 'provider_subject', type: 'varchar', length: 255 })
  providerSubject: string;

  /** The email the provider reported when linking; informational only. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
