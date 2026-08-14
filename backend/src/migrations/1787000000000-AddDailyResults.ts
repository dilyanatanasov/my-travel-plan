import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Server-side daily-puzzle results (2026-08-14): one row per user per UTC
 * day. UNIQUE(user_id, date) + first-write-wins in the service is the
 * anti-cheat — clearing your cache cannot re-roll a day you already
 * answered, because the answer of record lives here, not in the browser.
 * Guests are users too, so a guest who registers keeps their streak.
 */
export class AddDailyResults1787000000000 implements MigrationInterface {
  name = 'AddDailyResults1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "daily_results" (
        "id" SERIAL PRIMARY KEY,
        "user_id" integer NOT NULL
          REFERENCES "users"("id") ON DELETE CASCADE,
        "date" date NOT NULL,
        "won" boolean NOT NULL,
        "tries" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_daily_user_date" UNIQUE ("user_id", "date")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "daily_results"`);
  }
}
