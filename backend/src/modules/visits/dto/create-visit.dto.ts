import { IsInt, IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateVisitDto {
  @IsInt()
  countryId: number;

  @IsOptional()
  @IsDateString()
  visitedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
