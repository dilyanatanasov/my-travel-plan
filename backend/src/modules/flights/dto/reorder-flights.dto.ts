import { IsInt } from 'class-validator';

/**
 * Swap the replay order of two journeys. The service enforces the rule the
 * UI's arrows encode: both undated, or both on the exact same stored date.
 */
export class ReorderFlightsDto {
  @IsInt()
  aId: number;

  @IsInt()
  bId: number;
}
