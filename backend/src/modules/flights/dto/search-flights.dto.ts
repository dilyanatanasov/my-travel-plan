import {
  IsString,
  IsDateString,
  IsInt,
  IsEnum,
  IsOptional,
  Min,
  Max,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FilterOptionsDto } from './filter-options.dto';

export enum CabinClass {
  ECONOMY = 'economy',
  PREMIUM_ECONOMY = 'premium_economy',
  BUSINESS = 'business',
  FIRST = 'first',
}

export class SearchFlightsDto {
  @IsString()
  @Length(3, 3)
  origin: string; // IATA code (e.g., "JFK")

  @IsString()
  @Length(3, 3)
  destination: string; // IATA code (e.g., "LHR")

  @IsDateString()
  departureDate: string; // YYYY-MM-DD

  @IsOptional()
  @IsDateString()
  returnDate?: string; // YYYY-MM-DD (optional for one-way)

  @IsInt()
  @Min(1)
  @Max(9)
  passengers: number;

  @IsEnum(CabinClass)
  cabinClass: CabinClass;

  @IsOptional()
  @ValidateNested()
  @Type(() => FilterOptionsDto)
  filters?: FilterOptionsDto;
}
