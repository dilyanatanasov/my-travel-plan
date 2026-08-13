import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stored share cards for link previews.
 *
 * One row per user, keyed on user_id, replaced in place on every regenerate
 * (user decision: no history). The card is the PNG the browser rendered on
 * the Share screen — the server never draws one — so /s/<token> links can
 * unfurl with the user's actual map instead of the generic site image.
 *
 * bytea rather than files on disk: a card is ~300 KB, there is at most one
 * per user, and keeping it in Postgres means the existing pg_dump backups
 * carry it and a redeployed container loses nothing.
 *
 * width/height are parsed from the PNG header at upload time and are what
 * the unfurl HTML reports as og:image:width/height, so crawlers can lay out
 * the preview before fetching the image.
 */
export class AddShareCards1786400000000 implements MigrationInterface {
  name = 'AddShareCards1786400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "share_cards" (
        "user_id" integer PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
        "image" bytea NOT NULL,
        "width" integer NOT NULL,
        "height" integer NOT NULL,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "share_cards"`);
  }
}
