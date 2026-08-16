import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

/** Per-provider monthly spend; the budget gate's persistent memory. */
@Entity('api_spend_ledger')
@Unique('uq_spend_provider_month', ['provider', 'periodMonth'])
export class ApiSpend {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 16 })
  provider: string;

  /** YYYY-MM. */
  @Column({ name: 'period_month', length: 7 })
  periodMonth: string;

  @Column({ default: 0 })
  calls: number;

  @Column({ name: 'est_cost', type: 'numeric', precision: 10, scale: 4, default: 0 })
  estCost: number;
}
