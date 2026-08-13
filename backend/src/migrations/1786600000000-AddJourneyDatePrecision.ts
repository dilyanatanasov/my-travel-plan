import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Partial journey dates: "May 2019" and "2016" are real memories.
 *
 * The date column stays a date, stored as the first day of the period, so
 * every ordering (including the replay) keeps working untouched — precision
 * only changes what the UI renders and what the form asks for. Existing rows
 * were all entered through the exact-date picker, hence the 'day' default.
 */
export class AddJourneyDatePrecision1786600000000 implements MigrationInterface {
  name = 'AddJourneyDatePrecision1786600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "flight_journeys" ADD COLUMN "date_precision" varchar(5) NOT NULL DEFAULT 'day'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "flight_journeys" DROP COLUMN "date_precision"`,
    );
  }
}
