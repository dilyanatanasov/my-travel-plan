import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Land travel (2026-08-17): people move between cities by train, car and
 * bus, not only between airports by plane. Legs gain a travel_mode, and a
 * cities table (GeoNames cities1000, seeded like airports) provides the
 * endpoints - "Varna to Plovdiv by train" needs a city's name and
 * coordinates, nothing more. Airport columns relax to nullable: a land
 * leg has city endpoints instead, and a CHECK keeps every endpoint
 * exactly one of the two.
 *
 * Historical note: until now a sub-100km hop between airports was
 * DELETED as a "ground transfer" (1786500000000). Mode inverts that
 * politely - the splitter keeps guarding all-flight chains, but a leg
 * the user marked as land is the point, not garbage.
 */
export class AddLandTravel1787600000000 implements MigrationInterface {
  name = 'AddLandTravel1787600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "cities" (
        "id" SERIAL PRIMARY KEY,
        "geonames_id" integer NOT NULL UNIQUE,
        "name" character varying(200) NOT NULL,
        "ascii_name" character varying(200) NOT NULL,
        "country_iso" character(2) NOT NULL,
        "latitude" decimal(9,6) NOT NULL,
        "longitude" decimal(9,6) NOT NULL,
        "population" integer NOT NULL DEFAULT 0
      )
    `);
    // Prefix search runs on lower(ascii_name); population orders results.
    await queryRunner.query(
      `CREATE INDEX "idx_cities_ascii_name" ON "cities" (lower("ascii_name") text_pattern_ops)`,
    );

    await queryRunner.query(`
      ALTER TABLE "flight_legs"
      ADD COLUMN "travel_mode" character varying(10) NOT NULL DEFAULT 'flight'
    `);
    await queryRunner.query(`
      ALTER TABLE "flight_legs"
      ADD COLUMN "departure_city_id" integer REFERENCES "cities"("id"),
      ADD COLUMN "arrival_city_id" integer REFERENCES "cities"("id")
    `);
    await queryRunner.query(`
      ALTER TABLE "flight_legs"
      ALTER COLUMN "departure_airport_id" DROP NOT NULL,
      ALTER COLUMN "arrival_airport_id" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "flight_legs"
      ADD CONSTRAINT "chk_leg_departure_endpoint"
        CHECK (("departure_airport_id" IS NULL) <> ("departure_city_id" IS NULL)),
      ADD CONSTRAINT "chk_leg_arrival_endpoint"
        CHECK (("arrival_airport_id" IS NULL) <> ("arrival_city_id" IS NULL))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "flight_legs"
      DROP CONSTRAINT "chk_leg_departure_endpoint",
      DROP CONSTRAINT "chk_leg_arrival_endpoint"
    `);
    await queryRunner.query(
      `DELETE FROM "flight_legs" WHERE "travel_mode" <> 'flight'`,
    );
    await queryRunner.query(`
      ALTER TABLE "flight_legs"
      ALTER COLUMN "departure_airport_id" SET NOT NULL,
      ALTER COLUMN "arrival_airport_id" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "flight_legs"
      DROP COLUMN "departure_city_id",
      DROP COLUMN "arrival_city_id",
      DROP COLUMN "travel_mode"
    `);
    await queryRunner.query(`DROP TABLE "cities"`);
  }
}
