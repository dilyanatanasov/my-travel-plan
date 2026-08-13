import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';

export class UpdateFlightDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @IsInt({ each: true })
  airportIds?: number[];

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
