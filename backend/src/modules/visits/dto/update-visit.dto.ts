import { IsOptional, IsString, IsDateString, IsIn } from 'class-validator';

export class UpdateVisitDto {
  @IsOptional()
  @IsDateString()
  visitedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['trip', 'transit', 'home'])
  visitType?: 'trip' | 'transit' | 'home';
}
