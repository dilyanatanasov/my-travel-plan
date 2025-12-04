import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Visit } from './entities/visit.entity';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';

@Injectable()
export class VisitsService {
  constructor(
    @InjectRepository(Visit)
    private readonly visitRepository: Repository<Visit>,
  ) {}

  async findAll(): Promise<Visit[]> {
    return this.visitRepository.find({
      relations: ['country'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Visit> {
    const visit = await this.visitRepository.findOne({
      where: { id },
      relations: ['country'],
    });
    if (!visit) {
      throw new NotFoundException(`Visit with ID ${id} not found`);
    }
    return visit;
  }

  async create(createVisitDto: CreateVisitDto): Promise<Visit> {
    const visit = this.visitRepository.create(createVisitDto);
    const savedVisit = await this.visitRepository.save(visit);
    // Return with country relation for immediate UI update
    return this.findOne(savedVisit.id);
  }

  async update(id: number, updateVisitDto: UpdateVisitDto): Promise<Visit> {
    const visit = await this.findOne(id);
    Object.assign(visit, updateVisitDto);
    return this.visitRepository.save(visit);
  }

  async remove(id: number): Promise<void> {
    const visit = await this.findOne(id);
    await this.visitRepository.remove(visit);
  }
}
