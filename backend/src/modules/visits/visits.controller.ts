import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { VisitsService } from './visits.service';
import { Visit } from './entities/visit.entity';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get()
  async findAll(@CurrentUser('id') userId: number): Promise<Visit[]> {
    return this.visitsService.findAll(userId);
  }

  @Get('home')
  async getHomeCountry(
    @CurrentUser('id') userId: number,
  ): Promise<Visit | null> {
    return this.visitsService.getHomeCountry(userId);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Visit> {
    return this.visitsService.findOne(userId, id);
  }

  @Post()
  async create(
    @CurrentUser('id') userId: number,
    @Body() createVisitDto: CreateVisitDto,
  ): Promise<Visit> {
    return this.visitsService.create(userId, createVisitDto);
  }

  @Post('home/:countryId')
  async setHomeCountry(
    @CurrentUser('id') userId: number,
    @Param('countryId', ParseIntPipe) countryId: number,
  ): Promise<Visit> {
    return this.visitsService.setHomeCountry(userId, countryId);
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateVisitDto: UpdateVisitDto,
  ): Promise<Visit> {
    return this.visitsService.update(userId, id, updateVisitDto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.visitsService.remove(userId, id);
  }
}
