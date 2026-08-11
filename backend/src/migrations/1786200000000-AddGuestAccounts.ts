import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Guest accounts: use the app before signing up.
 *
 * A guest gets a real user row rather than browser-local storage, so every
 * query, guard and derivation already written keeps working unchanged, and
 * signing up later *upgrades the same row* — there is no migration step
 * between guest data and account data that could lose something.
 *
 * That requires email and password to become nullable, since a guest has
 * neither. The unique index on email still holds: Postgres allows many NULLs
 * in a unique column.
 */
export class AddGuestAccounts1786200000000 implements MigrationInterface {
  name = 'AddGuestAccounts1786200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "is_guest" boolean NOT NULL DEFAULT false`,
    );
    // Guests are swept up periodically; this is what the sweep sorts on.
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "last_seen_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_is_guest_last_seen" ON "users" ("is_guest", "last_seen_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_is_guest_last_seen"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_seen_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_guest"`);
    // Reverting needs the guests gone first, since they have no credentials.
    await queryRunner.query(`DELETE FROM "users" WHERE "email" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`,
    );
  }
}
