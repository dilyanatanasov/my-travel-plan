import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('airports')
export class Airport {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'iata_code', length: 3, unique: true })
  iataCode: string;

  @Column({ name: 'icao_code', length: 4, nullable: true })
  icaoCode: string;

  @Column({ length: 200 })
  name: string;

  @Index()
  @Column({ length: 100, nullable: true })
  city: string;

  @Column({ length: 100, nullable: true })
  country: string;

  @Column({ name: 'country_iso', length: 2, nullable: true })
  countryIso: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
