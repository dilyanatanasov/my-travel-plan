import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * User-controlled replay order (2026-08-14): two journeys on the same date
 * played in arbitrary order, and the user does not want to enter hours.
 *
 * sort_index breaks ties — dated journeys order by (journey_date,
 * sort_index), undated ones purely by sort_index. Backfilled to id, which
 * is creation order, so nothing moves until someone reorders. New rows get
 * their own id as sort_index at insert time.
 */
export class AddJourneySortIndex1786800000000 implements MigrationInterface {
  name = 'AddJourneySortIndex1786800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "flight_journeys" ADD COLUMN "sort_index" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `UPDATE "flight_journeys" SET "sort_index" = "id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "flight_journeys" DROP COLUMN "sort_index"`,
    );
  }
}
