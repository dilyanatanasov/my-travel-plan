import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  StreamableFile,
  Header,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { Throttle } from '@nestjs/throttler';
import { NonGuestGuard } from '../auth/guards/non-guest.guard';
import { FlightsService } from './flights.service';
import { FlightsStatsService, FlightStats } from './flights-stats.service';
import { FlightSearchService } from './services/flight-search.service';
import { FlightExplorationService } from './services/flight-exploration.service';
import { FilterService, SortOption } from './services/filter.service';
import { CreateFlightDto } from './dto/create-flight.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { FlexibleSearchDto } from './dto/flexible-search.dto';
import { SmartSearchDto, SmartSearchResultDto } from './dto/smart-search.dto';
import { SearchOrchestratorService } from './services/search-orchestrator.service';
import { FlightSearchResultDto } from './dto/flight-result.dto';
import { FlightExplorationResultDto } from './dto/flight-exploration-result.dto';
import { ImportFlightsDto, type ImportResultDto } from './dto/import-flights.dto';
import { ReorderFlightsDto } from './dto/reorder-flights.dto';
import { FlightJourney } from './entities/flight-journey.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LegPhotosService, LEG_PHOTOS_DIR } from './leg-photos.service';
import { SUPPORTED_IMAGE_MIME_TYPES } from '../../common/services/image-processing.service';

/*
  Trip-photo upload plumbing (2026-08-14). Random hex names carry nothing
  about the user or the trip; the MIME filter is the first gate, the
  magic-byte check in ImageProcessingService the second.
*/
const legPhotoStorage = diskStorage({
  destination: LEG_PHOTOS_DIR,
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase() || '.img';
    cb(null, `${randomBytes(16).toString('hex')}${ext}`);
  },
});

const legPhotoFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: (error: Error | null, accept: boolean) => void,
) => {
  if ((SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestException('Only JPEG, PNG or WebP photos are allowed'),
      false,
    );
  }
};

@Controller('flights')
export class FlightsController {
  constructor(
    private readonly flightsService: FlightsService,
    private readonly flightsStatsService: FlightsStatsService,
    private readonly flightSearchService: FlightSearchService,
    private readonly flightExplorationService: FlightExplorationService,
    private readonly filterService: FilterService,
    private readonly legPhotosService: LegPhotosService,
    private readonly searchOrchestrator: SearchOrchestratorService,
  ) {}

  /**
   * Trip photos: one per stop, owner-only end to end. Literal 'legs/photos'
   * is declared before the ':legId' routes so it cannot be captured as an
   * id. Serving streams through the ownership check — deliberately never
   * public static files.
   */
  @Get('legs/photos')
  async listLegPhotos(@CurrentUser('id') userId: number) {
    return { legIds: await this.legPhotosService.listLegIds(userId) };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('legs/:legId/photo')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: legPhotoStorage,
      fileFilter: legPhotoFileFilter,
      // 10MB raw; compressed server-side to ~300KB.
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadLegPhoto(
    @CurrentUser('id') userId: number,
    @Param('legId', ParseIntPipe) legId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.legPhotosService.upload(userId, legId, file);
  }

  @Get('legs/:legId/photo')
  @Header('Content-Type', 'image/jpeg')
  @Header('Cache-Control', 'private, max-age=86400')
  async getLegPhoto(
    @CurrentUser('id') userId: number,
    @Param('legId', ParseIntPipe) legId: number,
  ): Promise<StreamableFile> {
    const { stream } = await this.legPhotosService.stream(userId, legId);
    return new StreamableFile(stream);
  }

  @Delete('legs/:legId/photo')
  async deleteLegPhoto(
    @CurrentUser('id') userId: number,
    @Param('legId', ParseIntPipe) legId: number,
  ): Promise<void> {
    return this.legPhotosService.remove(userId, legId);
  }

  /**
   * Live flight search. Each call hits the paid RapidAPI upstream, so it is
   * gated to registered accounts (not free guest sessions) and throttled well
   * below the global ceiling — one script must not be able to burn the API
   * quota or run up a bill.
   */
  @UseGuards(NonGuestGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('search')
  async searchFlights(
    @Body() searchFlightsDto: SearchFlightsDto,
    @Query('sortBy') sortBy?: SortOption,
  ): Promise<FlightSearchResultDto> {
    const results = await this.flightSearchService.searchFlights(searchFlightsDto);

    // Apply filters if provided
    if (searchFlightsDto.filters || sortBy) {
      return this.filterService.applyFilters(
        results,
        searchFlightsDto.filters || {},
        sortBy,
      );
    }

    return results;
  }

  /**
   * The v2 funnel (M2, non-streaming — M3 adds the SSE variant): surface →
   * candidates → precise → judgement, budget-gated and capped at 25
   * upstream calls per search. Same gate as explore: registered accounts,
   * a few per minute — this endpoint can spend real money.
   */
  @UseGuards(NonGuestGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('smart-search')
  async smartSearch(
    @Body() dto: SmartSearchDto,
  ): Promise<SmartSearchResultDto> {
    return this.searchOrchestrator.runSearch(dto);
  }

  /**
   * Flexible exploration fans out to ~80 upstream calls per request, so it is
   * gated and throttled harder than plain search: registered accounts only,
   * a few per minute.
   */
  @UseGuards(NonGuestGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('explore')
  async exploreFlights(
    @Body() flexibleSearchDto: FlexibleSearchDto,
  ): Promise<FlightExplorationResultDto> {
    return this.flightExplorationService.explore(flexibleSearchDto);
  }

  /**
   * Bulk import. Idempotent: re-uploading the same file skips rows that are
   * already present rather than duplicating them.
   *
   * Declared above the parameterless @Post so route matching is unambiguous.
   */
  @Post('import')
  async importFlights(
    @CurrentUser('id') userId: number,
    @Body() dto: ImportFlightsDto,
  ): Promise<ImportResultDto> {
    return this.flightsService.importJourneys(userId, dto.journeys);
  }

  @Get()
  async findAll(@CurrentUser('id') userId: number): Promise<FlightJourney[]> {
    return this.flightsService.findAll(userId);
  }

  /** Swap the replay order of two same-date (or both-undated) journeys. */
  @Post('reorder')
  async reorder(
    @CurrentUser('id') userId: number,
    @Body() dto: ReorderFlightsDto,
  ): Promise<void> {
    return this.flightsService.reorder(userId, dto.aId, dto.bId);
  }

  /**
   * Just the totals the map's initial view needs, computed with COUNT/SUM in
   * the DB. Kept ahead of `/:id` so the literal path wins the route match.
   */
  @Get('summary')
  async getSummary(@CurrentUser('id') userId: number) {
    return this.flightsStatsService.getSummary(userId);
  }

  @Get('stats')
  async getStats(@CurrentUser('id') userId: number): Promise<FlightStats> {
    return this.flightsStatsService.getStats(userId);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FlightJourney> {
    return this.flightsService.findOne(userId, id);
  }

  @Post()
  async create(
    @CurrentUser('id') userId: number,
    @Body() createFlightDto: CreateFlightDto,
  ): Promise<FlightJourney> {
    return this.flightsService.create(userId, createFlightDto);
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateFlightDto: UpdateFlightDto,
  ): Promise<FlightJourney> {
    return this.flightsService.update(userId, id, updateFlightDto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.flightsService.remove(userId, id);
  }
}
