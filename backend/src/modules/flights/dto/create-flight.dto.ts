import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
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

export class CreateFlightDto {
  @IsOptional()
  @IsDateString()
  journeyDate?: string;

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
}
