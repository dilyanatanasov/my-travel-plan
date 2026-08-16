import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Web-push subscriptions (2026-08-16, M1 of the push plan). One row per
 * browser endpoint; a user holds several (phone + desktop). The endpoint is
 * globally unique by construction — it identifies one browser profile — so
 * re-subscribing on a shared device reassigns the row to whoever is signed
 * in, which is the correct outcome. Rows die with the user (cascade) and
 * are pruned when the push service reports them gone (404/410).
 */
export class AddPushSubscriptions1787100000000 implements MigrationInterface {
  name = 'AddPushSubscriptions1787100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "push_subscriptions" (
        "id" SERIAL PRIMARY KEY,
        "user_id" integer NOT NULL
          REFERENCES "users"("id") ON DELETE CASCADE,
        "endpoint" text NOT NULL,
        "p256dh" varchar(255) NOT NULL,
        "auth" varchar(255) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "last_seen_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_push_endpoint" UNIQUE ("endpoint")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_push_user" ON "push_subscriptions" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "push_subscriptions"`);
  }
}
