import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { CabinClass } from './search-flights.dto';
import { FlightResultDto } from './flight-result.dto';
import { PricePoint } from '../providers/flight-provider.interface';
import {
  CandidatePick,
  Judgement,
} from '../services/search-funnel.util';

/** "May, SOF→NRT, at least 5 nights" — the structured form's shape. */
export class SmartSearchDto {
  @IsString()
  @Length(3, 3)
  origin: string;

  @IsString()
  @Length(3, 3)
  destination: string;

  /** Month to survey, YYYY-MM. */
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
  @IsInt()
  @Min(1)
  @Max(9)
  passengers?: number;

  @IsOptional()
  @IsEnum(CabinClass)
  cabinClass?: CabinClass;
}

export interface SmartSearchMeta {
  upstreamCalls: number;
  cacheHits: number;
  durationMs: number;
  /** Set when a budget cap stopped the funnel from paying providers. */
  degraded: boolean;
}

export interface SmartSearchResultDto {
  origin: string;
  destination: string;
  month: string;
  /** The calendar heat-map data: estimate prices per date pair. */
  surface: PricePoint[];
  candidates: CandidatePick[];
  results: FlightResultDto[];
  judgements: Judgement[];
  periodMedian: number | null;
  meta: SmartSearchMeta;
}
