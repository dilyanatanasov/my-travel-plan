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

  @Column({ name: 'iso_code_2', length: 2, unique: true })
  isoCode2: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Visit, (visit) => visit.country)
  visits: Visit[];
}
