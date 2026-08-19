import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TravelStopDto,
  TRAVEL_MODES,
  type TravelModeDto,
} from './create-flight.dto';

export class UpdateFlightDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @IsInt({ each: true })
  airportIds?: number[];

  /** Mixed-mode replacement chain - same shape as create's option 3. */
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

  /** Per-hop terrain-route km, same contract as create (see create DTO). */
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  routeDistancesKm?: number[];

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
}
