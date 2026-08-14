import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trip photos (2026-08-14): one photo per stop, shown as a postcard when
 * the replay lands there. UNIQUE(leg_id) IS the cap — re-upload replaces.
 * Files live on the uploads volume; this row is the pointer and the
 * ownership record. user_id denormalized so the authed serving endpoint
 * checks ownership without joining through journeys.
 */
export class AddLegPhotos1786900000000 implements MigrationInterface {
  name = 'AddLegPhotos1786900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "leg_photos" (
        "id" SERIAL PRIMARY KEY,
        "leg_id" integer NOT NULL UNIQUE
          REFERENCES "flight_legs"("id") ON DELETE CASCADE,
        "user_id" integer NOT NULL
          REFERENCES "users"("id") ON DELETE CASCADE,
        "filename" varchar(64) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_leg_photos_user" ON "leg_photos" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "leg_photos"`);
  }
}
