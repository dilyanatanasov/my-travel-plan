import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Google sign-in (2026-10-03). A user_identities row links an account to a
 * provider's stable subject id; the users table itself is untouched since
 * email and password_hash were already nullable. Deleting a user removes
 * its identities with it (GDPR erasure stays one delete).
 */
export class AddUserIdentities1787900000000 implements MigrationInterface {
  name = 'AddUserIdentities1787900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_identities" (
        "id" SERIAL PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "provider" character varying(20) NOT NULL,
        "provider_subject" character varying(255) NOT NULL,
        "email" character varying(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_user_identities_provider_subject" UNIQUE ("provider", "provider_subject")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_user_identities_user" ON "user_identities" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_identities"`);
  }
}
