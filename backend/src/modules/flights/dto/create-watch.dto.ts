import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateWatchDto {
  @IsString()
  @Length(3, 3)
  origin: string;

  @IsString()
  @Length(3, 3)
  destination: string;

  @Matches(/^\d{4}-\d{2}$/)
  month: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  minNights?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  maxNights?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100_000)
  thresholdPrice?: number;
}
