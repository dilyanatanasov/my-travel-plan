import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Visit } from '../../visits/entities/visit.entity';

@Entity('countries')
export class Country {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'iso_code', length: 3, unique: true })
  isoCode: string;

  /**
   * Alpha-2, except the UK's four countries which carry their ISO 3166-2
   * code (GB-ENG, GB-SCT, GB-WLS, GB-NIR) - also the flag-icons name.
   */
  @Column({ name: 'iso_code_2', length: 6, unique: true })
  isoCode2: string;

  /**
   * Bonus places - ISO territories like Puerto Rico or the Faroe Islands.
   * Markable and painted like any country, but excluded from every
   * "X of the world" denominator so their existence shifts nobody's stats.
   */
  @Column({ name: 'is_territory', default: false })
  isTerritory: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Visit, (visit) => visit.country)
  visits: Visit[];
}
