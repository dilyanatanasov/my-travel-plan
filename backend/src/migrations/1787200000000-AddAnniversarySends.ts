import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Send-log for anniversary pushes (2026-08-16, M2). The unique
 * (user_id, journey_id, year) is the dedup guard: the sweep claims a row
 * with INSERT … ON CONFLICT DO NOTHING before sending, so a restart or a
 * second container mid-day cannot notify twice about the same trip.
 */
export class AddAnniversarySends1787200000000 implements MigrationInterface {
  name = 'AddAnniversarySends1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "anniversary_sends" (
        "id" SERIAL PRIMARY KEY,
        "user_id" integer NOT NULL
          REFERENCES "users"("id") ON DELETE CASCADE,
        "journey_id" integer NOT NULL
          REFERENCES "flight_journeys"("id") ON DELETE CASCADE,
        "year" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_anniversary_once" UNIQUE ("user_id", "journey_id", "year")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "anniversary_sends"`);
  }
}
