import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Search v2 M1 (2026-08-16, plan 2026-08-11): every price the funnel ever
 * observes is kept — the surface cache, the "under the May median" anchors
 * and the future watches all read from price_observations. api_spend_ledger
 * is the budget manager's memory: per-provider monthly call counts survive
 * restarts, so a redeploy cannot reset the month's spend to zero.
 */
export class AddSearchV2Tables1787300000000 implements MigrationInterface {
  name = 'AddSearchV2Tables1787300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "price_observations" (
        "id" SERIAL PRIMARY KEY,
        "origin" varchar(3) NOT NULL,
        "destination" varchar(3) NOT NULL,
        "departure_date" date NOT NULL,
        "return_date" date,
        "nights" integer,
        "total_price" numeric(10,2) NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'USD',
        "provider" varchar(16) NOT NULL,
        "cabin" varchar(20) NOT NULL DEFAULT 'economy',
        "passengers" integer NOT NULL DEFAULT 1,
        "is_estimate" boolean NOT NULL DEFAULT true,
        "observed_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_obs_route_date"
        ON "price_observations" ("origin", "destination", "departure_date")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_obs_route_seen"
        ON "price_observations" ("origin", "destination", "observed_at")
    `);

    await queryRunner.query(`
      CREATE TABLE "api_spend_ledger" (
        "id" SERIAL PRIMARY KEY,
        "provider" varchar(16) NOT NULL,
        "period_month" varchar(7) NOT NULL,
        "calls" integer NOT NULL DEFAULT 0,
        "est_cost" numeric(10,4) NOT NULL DEFAULT 0,
        CONSTRAINT "uq_spend_provider_month" UNIQUE ("provider", "period_month")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "api_spend_ledger"`);
    await queryRunner.query(`DROP TABLE "price_observations"`);
  }
}
