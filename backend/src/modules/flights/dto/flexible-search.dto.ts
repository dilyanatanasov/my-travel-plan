import {
  IsString,
  IsDateString,
  IsInt,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
  Max,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { CabinClass } from './search-flights.dto';

export enum DateType {
  SPECIFIC = 'specific',
  MONTH = 'month',
  RANGE = 'range',
  WEEKENDS = 'weekends',
}

export class FlexibleSearchDto {
  @IsString()
  @Length(3, 3)
  origin: string; // IATA code

  @IsString()
  @Length(3, 3)
  destination: string; // IATA code

  @IsEnum(DateType)
  dateType: DateType;

  // For SPECIFIC date type
  @ValidateIf((o) => o.dateType === DateType.SPECIFIC)
  @IsDateString()
  departureDate?: string; // YYYY-MM-DD

  @ValidateIf((o) => o.dateType === DateType.SPECIFIC)
  @IsOptional()
  @IsDateString()
  returnDate?: string; // YYYY-MM-DD

  // For MONTH date type (e.g., "2025-03")
  @ValidateIf((o) => o.dateType === DateType.MONTH)
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'Month must be in YYYY-MM format' })
  month?: string;

  // For RANGE or WEEKENDS date type
  @ValidateIf((o) => o.dateType === DateType.RANGE || o.dateType === DateType.WEEKENDS)
  @IsDateString()
  dateRangeStart?: string; // YYYY-MM-DD

  @ValidateIf((o) => o.dateType === DateType.RANGE || o.dateType === DateType.WEEKENDS)
  @IsDateString()
  dateRangeEnd?: string; // YYYY-MM-DD

  // Duration - used with MONTH, RANGE, and WEEKENDS
  @ValidateIf((o) => o.dateType !== DateType.SPECIFIC)
  @IsInt()
  @Min(1)
  @Max(30)
  minNights: number;

  @ValidateIf((o) => o.dateType !== DateType.SPECIFIC)
  @IsInt()
  @Min(1)
  @Max(30)
  maxNights: number;

  @IsInt()
  @Min(1)
  @Max(9)
  passengers: number;

  @IsEnum(CabinClass)
  cabinClass: CabinClass;

  // Optional: preferred connection hubs (for Phase 3)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredHubs?: string[];

  // Optional: hubs to exclude (for Phase 3)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeHubs?: string[];

  // Optional: max travel time per leg in hours
  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(48)
  maxTravelTimeHours?: number;

  // Optional: allow different routing for return (for Phase 4)
  @IsOptional()
  @IsBoolean()
  allowAsymmetricRouting?: boolean;
}
