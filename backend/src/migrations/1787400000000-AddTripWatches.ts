import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trip watches (search v2 M4): "tell me when SOF→NRT in October drops".
 * A watch is scoped to a user and dies with them; last_notified_* is the
 * alert debounce's memory.
 */
export class AddTripWatches1787400000000 implements MigrationInterface {
  name = 'AddTripWatches1787400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "trip_watches" (
        "id" SERIAL PRIMARY KEY,
        "user_id" integer NOT NULL
          REFERENCES "users"("id") ON DELETE CASCADE,
        "origin" varchar(3) NOT NULL,
        "destination" varchar(3) NOT NULL,
        "month" varchar(7) NOT NULL,
        "min_nights" integer,
        "max_nights" integer,
        "threshold_price" numeric(10,2),
        "last_notified_price" numeric(10,2),
        "last_notified_at" TIMESTAMP,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_watch_route" UNIQUE ("user_id", "origin", "destination", "month")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_watches_active" ON "trip_watches" ("active")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "trip_watches"`);
  }
}
