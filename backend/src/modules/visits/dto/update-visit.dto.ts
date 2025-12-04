import { IsOptional, IsString, IsDateString } from 'class-validator';

export class UpdateVisitDto {
  @IsOptional()
  @IsDateString()
  visitedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
