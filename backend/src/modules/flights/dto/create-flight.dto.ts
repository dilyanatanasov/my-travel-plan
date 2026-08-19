import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  Min,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFlightLegDto {
  @IsInt()
  departureAirportId: number;

  @IsInt()
  arrivalAirportId: number;
}

export const TRAVEL_MODES = ['flight', 'train', 'car', 'bus', 'ferry'] as const;
export type TravelModeDto = (typeof TRAVEL_MODES)[number];

/** One stop in a mixed-mode chain: exactly one of airport or city. */
export class TravelStopDto {
  @IsOptional()
  @IsInt()
  airportId?: number;

  @IsOptional()
  @IsInt()
  cityId?: number;
}

export class CreateFlightDto {
  @IsOptional()
  @IsDateString()
  journeyDate?: string;

  @IsOptional()
  @IsIn(['day', 'month', 'year'])
  datePrecision?: 'day' | 'month' | 'year';

  @IsOptional()
  @IsBoolean()
  isRoundTrip?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  // Option 1: Provide explicit legs
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFlightLegDto)
  legs?: CreateFlightLegDto[];

  // Option 2: Provide chain of airport IDs (simpler for frontend)
  // [VAR_id, IST_id, LIS_id] -> creates legs VAR->IST, IST->LIS
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(2)
  airportIds?: number[];

  /*
    Option 3 (land travel, 2026-08-17): a mixed-mode chain. Stops are
    airports or cities; modes has one entry per hop (defaults to flight).
    Varna(A) -> Geneva(A) -> Basel(C) -> Colmar(C) with
    modes [flight, train, car] is one journey whose glyph changes at
    each stop. When stops is present it wins over the other two shapes.
  */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TravelStopDto)
  @ArrayMinSize(2)
  stops?: TravelStopDto[];

  @IsOptional()
  @IsArray()
  @IsIn(TRAVEL_MODES, { each: true })
  modes?: TravelModeDto[];

  /*
    Honest surface distances (owner, 2026-08-19): one entry per hop,
    aligned with `modes`. The CLIENT knows the terrain route (the ferry
    around the cape, the train over the bridge) because it computed it
    for the map; the straight-line km the server can derive undersells
    every surface leg. Null/absent entries fall back to haversine, and
    the service clamps each value against the haversine so a buggy or
    malicious client cannot inflate stats unboundedly.
  */
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  routeDistancesKm?: number[];
}
