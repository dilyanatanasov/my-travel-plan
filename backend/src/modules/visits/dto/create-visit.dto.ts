import { IsInt, IsOptional, IsString, IsDateString, IsIn } from 'class-validator';

export class CreateVisitDto {
  @IsOptional()
  @IsInt()
  countryId?: number;

  @IsOptional()
  @IsString()
  countryIso?: string; // Alternative to countryId (2-letter ISO code)

  @IsOptional()
  @IsDateString()
  visitedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['trip', 'transit', 'home', 'wishlist', 'lived'])
  visitType?: 'trip' | 'transit' | 'home' | 'wishlist' | 'lived';

  @IsOptional()
  @IsIn(['manual', 'flight'])
  source?: 'manual' | 'flight';

  @IsOptional()
  @IsInt()
  flightJourneyId?: number;
}
