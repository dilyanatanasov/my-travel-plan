import {
  IsArray,
  IsOptional,
  IsString,
  IsDateString,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  MaxLength,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ImportLegDto {
  /** IATA code. Resolved server-side — the client never sends airport ids. */
  @IsString()
  @Length(3, 3)
  from: string;

  @IsString()
  @Length(3, 3)
  to: string;
}

export class ImportJourneyDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ImportLegDto)
  legs: ImportLegDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ImportFlightsDto {
  /**
   * Capped deliberately. A whole flight history is a few hundred rows; a
   * request larger than this is a mistake or an attack, and each row costs a
   * handful of queries.
   */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ImportJourneyDto)
  journeys: ImportJourneyDto[];
}

export interface ImportResultDto {
  imported: number;
  /** Already present with the same date and route — re-importing is safe. */
  skipped: number;
  failed: { row: number; route: string; reason: string }[];
}
