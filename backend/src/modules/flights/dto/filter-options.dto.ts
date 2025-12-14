import { IsOptional, IsNumber, IsArray, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterOptionsDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(5)
  maxStops?: number; // 0 = direct only, 1 = max 1 stop, etc.

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  minLayoverMinutes?: number; // Minimum layover time (e.g., 60 = 1 hour minimum)

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  maxLayoverMinutes?: number; // Maximum layover time (e.g., 180 = 3 hours max)

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  minPrice?: number; // Minimum price in user's currency

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  maxPrice?: number; // Maximum price in user's currency

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  airlines?: string[]; // Include only these carrier IATA codes

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeAirlines?: string[]; // Exclude these carrier IATA codes

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  maxDurationMinutes?: number; // Maximum total trip duration

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  minDurationMinutes?: number; // Minimum total trip duration
}
