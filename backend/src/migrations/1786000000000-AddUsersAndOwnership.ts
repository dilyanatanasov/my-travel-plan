import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Introduces user accounts and per-user ownership of travel data.
 *
 * Written by hand rather than generated: the existing schema was created by
 * `synchronize: true`, so a generated migration would also try to "correct"
 * unrelated drift between the entities and the live database. This migration
 * touches only what the auth feature needs.
 *
 * `user_id` lands NULLABLE on purpose. The dev database already holds real
 * rows (25 visits, 41 journeys) that cannot satisfy a NOT NULL constraint.
 * The first account created claims them — see AuthService.register().
 */
export class AddUsersAndOwnership1786000000000 implements MigrationInterface {
  name = 'AddUsersAndOwnership1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL NOT NULL,
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "display_name" character varying(100),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "visits" ADD COLUMN "user_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "flight_journeys" ADD COLUMN "user_id" integer`,
    );

    await queryRunner.query(`
      ALTER TABLE "visits"
        ADD CONSTRAINT "FK_visits_user_id"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "flight_journeys"
        ADD CONSTRAINT "FK_flight_journeys_user_id"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE
    `);

    // Every scoped query filters on user_id, so both need an index.
    await queryRunner.query(
      `CREATE INDEX "IDX_visits_user_id" ON "visits" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_flight_journeys_user_id" ON "flight_journeys" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_flight_journeys_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_visits_user_id"`);
    await queryRunner.query(
      `ALTER TABLE "flight_journeys" DROP CONSTRAINT "FK_flight_journeys_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "visits" DROP CONSTRAINT "FK_visits_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flight_journeys" DROP COLUMN "user_id"`,
    );
    await queryRunner.query(`ALTER TABLE "visits" DROP COLUMN "user_id"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
