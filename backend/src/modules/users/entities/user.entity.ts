import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Visit } from '../../visits/entities/visit.entity';
import { FlightJourney } from '../../flights/entities/flight-journey.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Null for guests, who have no credentials. Postgres permits many NULLs in
   * a unique column, so the uniqueness guarantee for real emails is intact.
   * Always stored lowercased so lookups are case-insensitive.
   */
  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  email: string | null;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  passwordHash: string | null;

  /**
   * An anonymous account created so someone can use the app before signing
   * up. Registering converts this row in place rather than creating a second
   * one, so nothing has to be migrated across.
   */
  @Column({ name: 'is_guest', type: 'boolean', default: false })
  isGuest: boolean;

  /** Drives cleanup of abandoned guest accounts. */
  @Column({ name: 'last_seen_at', type: 'timestamp', default: () => 'now()' })
  lastSeenAt: Date;

  @Column({ name: 'display_name', type: 'varchar', length: 100, nullable: true })
  displayName: string | null;

  /**
   * Random token for the public map. Null means sharing is off; clearing it
   * revokes every existing link. Deliberately not derived from the email or id
   * so a map cannot be found by guessing.
   */
  @Column({
    name: 'share_token',
    type: 'varchar',
    length: 24,
    nullable: true,
    unique: true,
  })
  shareToken: string | null;

  @OneToMany(() => Visit, (visit) => visit.user)
  visits: Visit[];

  @OneToMany(() => FlightJourney, (journey) => journey.user)
  flightJourneys: FlightJourney[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
