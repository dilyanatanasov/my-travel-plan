import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type BanType = 'full' | 'partial';
export type BanSource = 'EU_AIR_SAFETY_LIST' | 'FAA' | 'OTHER';

@Entity('banned_airlines')
export class BannedAirline {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'iata_code', type: 'varchar', length: 3, nullable: true })
  iataCode: string | null;

  @Index()
  @Column({ name: 'icao_code', type: 'varchar', length: 4, nullable: true })
  icaoCode: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'EU_AIR_SAFETY_LIST',
  })
  source: BanSource;

  @Column({
    name: 'ban_type',
    type: 'varchar',
    length: 50,
    default: 'full',
  })
  banType: BanType;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
