import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Saved duels: bookmarked opponent share-tokens, deliberately NOT a friend
 * graph. A row is a bookmark, not a relationship — there is no consent
 * machinery because the opponent's map is already public-by-link, and
 * revoking a share token still kills every duel it appears in. The token is
 * stored (not the user id) so revocation works exactly like it does for
 * share links: the bookmark simply stops resolving.
 */
export class AddSavedDuels1786700000000 implements MigrationInterface {
  name = 'AddSavedDuels1786700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "saved_duels" (
        "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "opponent_token" varchar(24) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        PRIMARY KEY ("user_id", "opponent_token")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "saved_duels"`);
  }
}
