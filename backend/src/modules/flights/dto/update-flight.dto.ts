import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsDateString,
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
