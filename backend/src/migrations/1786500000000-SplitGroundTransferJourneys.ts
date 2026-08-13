import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Retroactively split journeys at ground transfers.
 *
 * The create path now splits chains at hops under 100 km between different
 * airports (no commercial flight is that short — NRT→HND is a train across
 * Tokyo). This applies the same rule to journeys entered before the fix:
 * the transfer leg is deleted, legs after it move to a new journey, and leg
 * orders are renumbered.
 *
 * Dates: the original journey keeps its date; journeys created by the split
 * get NULL — the app's own replay rule is that guessing a date "asserts a
 * history the user never entered". A split journey stops claiming to be a
 * round trip. The detector reads the stored distance_km, so no coordinates
 * or haversine are needed here.
 */
export class SplitGroundTransferJourneys1786500000000
  implements MigrationInterface
{
  name = 'SplitGroundTransferJourneys1786500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $do$
      DECLARE
        j RECORD;
        leg RECORD;
        target_journey_id integer;
        next_order integer;
        did_split boolean;
        in_segment boolean;
      BEGIN
        FOR j IN
          SELECT DISTINCT fj.id, fj.user_id, fj.notes
          FROM flight_journeys fj
          JOIN flight_legs fl ON fl.journey_id = fj.id
          WHERE fl.distance_km < 100
            AND fl.departure_airport_id <> fl.arrival_airport_id
        LOOP
          target_journey_id := j.id;
          next_order := 0;
          did_split := false;
          in_segment := true;

          FOR leg IN
            SELECT fl.* FROM flight_legs fl
            WHERE fl.journey_id = j.id
            ORDER BY fl.leg_order
          LOOP
            IF leg.distance_km < 100
               AND leg.departure_airport_id <> leg.arrival_airport_id THEN
              -- The ground transfer itself: not a flight, delete it.
              DELETE FROM flight_legs WHERE id = leg.id;
              did_split := true;
              in_segment := false;
            ELSE
              IF NOT in_segment THEN
                -- First real flight after a transfer starts a new journey,
                -- undated on purpose (see docblock).
                INSERT INTO flight_journeys
                  (user_id, journey_date, is_round_trip, notes)
                VALUES (j.user_id, NULL, false, j.notes)
                RETURNING id INTO target_journey_id;
                next_order := 0;
                in_segment := true;
              END IF;
              next_order := next_order + 1;
              UPDATE flight_legs
              SET journey_id = target_journey_id, leg_order = next_order
              WHERE id = leg.id;
            END IF;
          END LOOP;

          IF NOT EXISTS (
            SELECT 1 FROM flight_legs WHERE journey_id = j.id
          ) THEN
            -- Chain started with (or was only) transfers: nothing flown
            -- remains on the original journey.
            DELETE FROM flight_journeys WHERE id = j.id;
          ELSIF did_split THEN
            UPDATE flight_journeys SET is_round_trip = false WHERE id = j.id;
          END IF;
        END LOOP;
      END
      $do$;
    `);
  }

  public async down(): Promise<void> {
    // Irreversible by design: merging journeys back would require knowing
    // which ones were split apart, and the deleted transfer legs are gone.
    // The deploy pipeline's pre-migration backup is the true undo.
  }
}
