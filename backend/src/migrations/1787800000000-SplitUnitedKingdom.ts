import { MigrationInterface, QueryRunner } from 'typeorm';
import { UK_CONSTITUENTS, UK_CONSTITUENT_ISOS, ukConstituentFor } from '../geo/uk-constituent';

/**
 * The United Kingdom becomes four countries (owner decision, 2026-10-03):
 * England, Scotland, Wales and Northern Ireland, each a full country
 * (is_territory = false, so the world total rises by three).
 *
 * Keys: alpha-2 is the ISO 3166-2 code (GB-ENG...), which is also the
 * flag-icons name; alpha-3 is Natural Earth's unit code (ENG, SCT, WLS,
 * NIR - none is an ISO alpha-3). Three columns widen from 2 to 6 for it.
 *
 * Data: every existing UK visit moves to England, per the owner ("assume
 * they went only to England"). Airports and cities that said GB are placed
 * in their real country by coordinates, so a future flight to Edinburgh
 * marks Scotland and a UK city picked for a land trip resolves at all -
 * createOrUpdateFromFlight silently creates nothing for an unknown code.
 * The United Kingdom row is deleted last; visits were its only reference.
 */
export class SplitUnitedKingdom1787800000000 implements MigrationInterface {
  name = 'SplitUnitedKingdom1787800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "countries" ALTER COLUMN "iso_code_2" TYPE character varying(6)`,
    );
    await queryRunner.query(
      `ALTER TABLE "airports" ALTER COLUMN "country_iso" TYPE character varying(6)`,
    );
    await queryRunner.query(
      `ALTER TABLE "cities" ALTER COLUMN "country_iso" TYPE character varying(6)`,
    );

    await queryRunner.query(`
      INSERT INTO "countries" ("name", "iso_code", "iso_code_2", "is_territory")
      VALUES
        ('England', 'ENG', 'GB-ENG', false),
        ('Scotland', 'SCT', 'GB-SCT', false),
        ('Wales', 'WLS', 'GB-WLS', false),
        ('Northern Ireland', 'NIR', 'GB-NIR', false)
      ON CONFLICT ("iso_code") DO NOTHING
    `);

    // UK visits -> England. A user who somehow already holds an England
    // row keeps it; their UK row goes rather than becoming a duplicate.
    await queryRunner.query(`
      DELETE FROM "visits" v
      USING "countries" gb, "countries" eng
      WHERE gb."iso_code" = 'GBR' AND eng."iso_code" = 'ENG'
        AND v."country_id" = gb."id"
        AND EXISTS (
          SELECT 1 FROM "visits" e
          WHERE e."user_id" = v."user_id" AND e."country_id" = eng."id"
        )
    `);
    await queryRunner.query(`
      UPDATE "visits" v
      SET "country_id" = eng."id"
      FROM "countries" gb, "countries" eng
      WHERE gb."iso_code" = 'GBR' AND eng."iso_code" = 'ENG'
        AND v."country_id" = gb."id"
    `);

    await this.reclassify(queryRunner, 'airports', true);
    await this.reclassify(queryRunner, 'cities', false);

    await queryRunner.query(`DELETE FROM "countries" WHERE "iso_code" = 'GBR'`);
  }

  /** Place every GB row of a table by its coordinates. */
  private async reclassify(
    queryRunner: QueryRunner,
    table: 'airports' | 'cities',
    hasCountryName: boolean,
  ): Promise<void> {
    const rows: { id: number; latitude: string; longitude: string }[] =
      await queryRunner.query(
        `SELECT "id", "latitude", "longitude" FROM "${table}" WHERE "country_iso" = 'GB'`,
      );
    const byIso = new Map<string, number[]>();
    for (const row of rows) {
      const iso = ukConstituentFor(Number(row.latitude), Number(row.longitude));
      if (!byIso.has(iso)) byIso.set(iso, []);
      byIso.get(iso).push(row.id);
    }
    for (const [iso, ids] of byIso) {
      const name = UK_CONSTITUENTS[iso as keyof typeof UK_CONSTITUENTS].name;
      await queryRunner.query(
        hasCountryName
          ? `UPDATE "${table}" SET "country_iso" = $1, "country" = $2 WHERE "id" = ANY($3)`
          : `UPDATE "${table}" SET "country_iso" = $1 WHERE "id" = ANY($2)`,
        hasCountryName ? [iso, name, ids] : [iso, ids],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "countries" ("name", "iso_code", "iso_code_2", "is_territory")
      VALUES ('United Kingdom', 'GBR', 'GB', false)
      ON CONFLICT ("iso_code") DO NOTHING
    `);
    const isoList = UK_CONSTITUENT_ISOS.map((iso) => `'${iso}'`).join(', ');
    const alpha3List = UK_CONSTITUENT_ISOS.map((iso) => `'${UK_CONSTITUENTS[iso].alpha3}'`).join(', ');

    // Four countries' visits fold back into one; keep one row per user.
    await queryRunner.query(`
      DELETE FROM "visits" v
      USING "countries" c
      WHERE v."country_id" = c."id" AND c."iso_code" IN (${alpha3List})
        AND v."id" <> (
          SELECT MIN(v2."id") FROM "visits" v2
          JOIN "countries" c2 ON c2."id" = v2."country_id"
          WHERE v2."user_id" = v."user_id" AND c2."iso_code" IN (${alpha3List})
        )
    `);
    await queryRunner.query(`
      UPDATE "visits" v
      SET "country_id" = gb."id"
      FROM "countries" c, "countries" gb
      WHERE v."country_id" = c."id" AND c."iso_code" IN (${alpha3List})
        AND gb."iso_code" = 'GBR'
    `);
    await queryRunner.query(
      `UPDATE "airports" SET "country_iso" = 'GB', "country" = 'United Kingdom' WHERE "country_iso" IN (${isoList})`,
    );
    await queryRunner.query(
      `UPDATE "cities" SET "country_iso" = 'GB' WHERE "country_iso" IN (${isoList})`,
    );
    await queryRunner.query(`DELETE FROM "countries" WHERE "iso_code" IN (${alpha3List})`);

    await queryRunner.query(
      `ALTER TABLE "cities" ALTER COLUMN "country_iso" TYPE character(2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "airports" ALTER COLUMN "country_iso" TYPE character varying(2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "countries" ALTER COLUMN "iso_code_2" TYPE character varying(2)`,
    );
  }
}
