import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Email verification + password reset.
 *
 * `email_verified` gates sharing (the register-spam defense): an unverified
 * account can use the app privately but cannot publish a public map link.
 * Accounts that already exist are grandfathered as verified — nobody loses
 * sharing because a deploy happened.
 *
 * `auth_tokens` holds both token kinds ('verify' | 'reset'). Only a SHA-256
 * hash is stored: the tokens are 32 random bytes, so offline guessing of a
 * leaked hash is hopeless, and a database read never yields a usable link.
 */
export class AddEmailAuth1786300000000 implements MigrationInterface {
  name = 'AddEmailAuth1786300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "email_verified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "users" SET "email_verified" = true WHERE "email" IS NOT NULL`,
    );
    await queryRunner.query(`
      CREATE TABLE "auth_tokens" (
        "id" SERIAL PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "type" varchar(10) NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "used_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_tokens_user_type" ON "auth_tokens" ("user_id", "type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_tokens_hash" ON "auth_tokens" ("token_hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "auth_tokens"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verified"`);
  }
}
