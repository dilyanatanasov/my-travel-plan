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

  // Always stored lowercased so lookups are case-insensitive
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

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
