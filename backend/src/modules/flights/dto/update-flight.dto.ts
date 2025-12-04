import { IsBoolean, IsOptional, IsString, IsDateString } from 'class-validator';

export class UpdateFlightDto {
  @IsOptional()
  @IsDateString()
  journeyDate?: string;

  @IsOptional()
  @IsBoolean()
  isRoundTrip?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
