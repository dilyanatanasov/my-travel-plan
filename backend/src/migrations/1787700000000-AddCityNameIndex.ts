import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The other half of the city typeahead index (2026-08-21).
 *
 * The search matches lower(ascii_name) OR lower(name), so that "plovdiv"
 * finds Пловдив - but only ascii_name was indexed. Postgres cannot serve
 * one branch of an OR from an index and invent the other, so every
 * keystroke fell back to a sequential scan of the whole table: 177ms for
 * a two-letter prefix, on a query the code comments describe as an index
 * range scan.
 *
 * With both expressions indexed the planner uses a BitmapOr over the two,
 * and the same query runs in 67ms. Longer prefixes, which is what people
 * actually type, drop to single-digit milliseconds because cost here
 * tracks how many rows the prefix matches rather than the table size.
 */
export class AddCityNameIndex1787700000000 implements MigrationInterface {
  name = 'AddCityNameIndex1787700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_cities_name" ON "cities" (lower("name") text_pattern_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_cities_name"`);
  }
}
