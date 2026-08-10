import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Opt-in public sharing.
 *
 * The presence of a token is what makes a map public — clearing the column
 * revokes every existing link immediately, with no separate enabled flag to
 * fall out of sync with it.
 */
export class AddShareToken1786100000000 implements MigrationInterface {
  name = 'AddShareToken1786100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "share_token" character varying(24)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_users_share_token" UNIQUE ("share_token")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_users_share_token"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "share_token"`);
  }
}
