import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bonus places (2026-08-17): the daily puzzle draws from a 241-entry atlas
 * that includes ISO territories - N. Mariana Is., Faroe Is., Puerto Rico -
 * but the countries table held only 197 sovereign states, so "mark it on
 * your map" pointed at places the app could not mark (owner report: the
 * map search could not produce today's daily answer at all).
 *
 * Territories are markable and painted but flagged is_territory, and every
 * "X of the world" denominator excludes them - nobody's percentage moves.
 * The set is exactly: ISO 3166-1 entries that have their own polygon in
 * the vendored 50m atlas and were not already countries. Dependencies
 * without a separate polygon (Guadeloupe, Réunion - drawn as France) are
 * deliberately absent: a row nobody can see or tap reads as broken.
 */
export class AddTerritories1787500000000 implements MigrationInterface {
  name = 'AddTerritories1787500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "countries"
      ADD COLUMN IF NOT EXISTS "is_territory" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      INSERT INTO "countries" ("name", "iso_code", "iso_code_2", "is_territory")
      VALUES
        ('Northern Mariana Islands', 'MNP', 'MP', true),
        ('U.S. Virgin Islands', 'VIR', 'VI', true),
        ('Guam', 'GUM', 'GU', true),
        ('American Samoa', 'ASM', 'AS', true),
        ('Puerto Rico', 'PRI', 'PR', true),
        ('Pitcairn Islands', 'PCN', 'PN', true),
        ('Falkland Islands', 'FLK', 'FK', true),
        ('Cayman Islands', 'CYM', 'KY', true),
        ('Bermuda', 'BMU', 'BM', true),
        ('Turks and Caicos Islands', 'TCA', 'TC', true),
        ('Niue', 'NIU', 'NU', true),
        ('Cook Islands', 'COK', 'CK', true),
        ('Western Sahara', 'ESH', 'EH', true),
        ('Saint Pierre and Miquelon', 'SPM', 'PM', true),
        ('Wallis and Futuna', 'WLF', 'WF', true),
        ('New Caledonia', 'NCL', 'NC', true),
        ('Greenland', 'GRL', 'GL', true),
        ('Faroe Islands', 'FRO', 'FO', true),
        ('Macao', 'MAC', 'MO', true),
        ('Hong Kong', 'HKG', 'HK', true),
        ('Norfolk Island', 'NFK', 'NF', true),
        ('South Georgia and the South Sandwich Islands', 'SGS', 'GS', true),
        ('British Indian Ocean Territory', 'IOT', 'IO', true),
        ('Saint Helena', 'SHN', 'SH', true),
        ('Anguilla', 'AIA', 'AI', true),
        ('British Virgin Islands', 'VGB', 'VG', true),
        ('Montserrat', 'MSR', 'MS', true),
        ('Jersey', 'JEY', 'JE', true),
        ('Guernsey', 'GGY', 'GG', true),
        ('Isle of Man', 'IMN', 'IM', true),
        ('Aruba', 'ABW', 'AW', true),
        ('Curaçao', 'CUW', 'CW', true),
        ('Saint Martin', 'MAF', 'MF', true),
        ('Saint Barthélemy', 'BLM', 'BL', true),
        ('French Polynesia', 'PYF', 'PF', true),
        ('French Southern Territories', 'ATF', 'TF', true),
        ('Åland Islands', 'ALA', 'AX', true),
        ('Heard Island and McDonald Islands', 'HMD', 'HM', true),
        ('Antarctica', 'ATA', 'AQ', true),
        ('Sint Maarten', 'SXM', 'SX', true)
      ON CONFLICT ("iso_code") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "countries" WHERE "is_territory" = true`,
    );
    await queryRunner.query(
      `ALTER TABLE "countries" DROP COLUMN IF EXISTS "is_territory"`,
    );
  }
}
