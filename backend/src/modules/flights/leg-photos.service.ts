import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createReadStream, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { ReadStream } from 'fs';
import { LegPhoto } from './entities/leg-photo.entity';
import { FlightLeg } from './entities/flight-leg.entity';
import { ImageProcessingService } from '../../common/services/image-processing.service';

/** Compressed photos live here, on the uploads volume in production. */
export const LEG_PHOTOS_DIR = join(process.cwd(), 'uploads', 'leg-photos');

/**
 * Trip photos: one per stop, private to their owner.
 *
 * Serving goes through requireOwned + a stream — deliberately NOT public
 * static /uploads (the one divergence from the ia-fitness pattern): travel
 * photos are personal, and an unguessable URL is still a URL that leaks.
 * Every path 404s rather than 403s, matching the journeys API — the
 * existence of someone else's photo is itself information.
 */
@Injectable()
export class LegPhotosService {
  /*
    Uploads process strictly one at a time. sharp inflates a phone photo to
    raw pixels (~190MB for 48MP); two concurrent uploads on the 2GB droplet
    would stack spikes toward the OOM killer, whose aim includes Postgres.
    A promise chain is the whole queue — waiting a second beats dying.
  */
  private processingChain: Promise<unknown> = Promise.resolve();

  constructor(
    @InjectRepository(LegPhoto)
    private readonly photoRepository: Repository<LegPhoto>,
    @InjectRepository(FlightLeg)
    private readonly legRepository: Repository<FlightLeg>,
    private readonly imageProcessing: ImageProcessingService,
  ) {
    mkdirSync(LEG_PHOTOS_DIR, { recursive: true });
  }

  /** The leg, only if it belongs to this user's journey; 404 otherwise. */
  private async requireOwnedLeg(
    userId: number,
    legId: number,
  ): Promise<FlightLeg> {
    const leg = await this.legRepository.findOne({
      where: { id: legId },
      relations: ['journey'],
    });
    if (!leg || leg.journey?.userId !== userId) {
      throw new NotFoundException('Stop not found');
    }
    return leg;
  }

  async upload(
    userId: number,
    legId: number,
    file: Express.Multer.File,
  ): Promise<{ legId: number }> {
    if (!file) throw new BadRequestException('No photo provided');
    await this.requireOwnedLeg(userId, legId);

    const run = this.processingChain.then(() =>
      this.imageProcessing.processUpload(file, {
        width: 1600,
        format: 'jpeg',
        quality: 80,
      }),
    );
    // The chain must survive a failed job, or one bad file wedges uploads
    // for the rest of the process's life.
    this.processingChain = run.catch(() => undefined);
    const { filename } = await run;

    // One per stop: replace the row and remove the file it pointed at.
    const existing = await this.photoRepository.findOne({ where: { legId } });
    if (existing) {
      this.removeFile(existing.filename);
      await this.photoRepository.delete(existing.id);
    }
    await this.photoRepository.save(
      this.photoRepository.create({ legId, userId, filename }),
    );
    return { legId };
  }

  /** Stream the photo to its owner; 404 for everyone and everything else. */
  async stream(
    userId: number,
    legId: number,
  ): Promise<{ stream: ReadStream }> {
    const photo = await this.photoRepository.findOne({
      where: { legId, userId },
    });
    const path = photo ? join(LEG_PHOTOS_DIR, photo.filename) : null;
    if (!photo || !path || !existsSync(path)) {
      throw new NotFoundException('Photo not found');
    }
    return { stream: createReadStream(path) };
  }

  async remove(userId: number, legId: number): Promise<void> {
    const photo = await this.photoRepository.findOne({
      where: { legId, userId },
    });
    if (!photo) throw new NotFoundException('Photo not found');
    this.removeFile(photo.filename);
    await this.photoRepository.delete(photo.id);
  }

  /** Leg ids that have photos, for the owner's own journeys — one query
   *  the frontend uses to decorate stops and schedule postcards. */
  async listLegIds(userId: number): Promise<number[]> {
    const rows = await this.photoRepository.find({
      where: { userId },
      select: ['legId'],
    });
    return rows.map((row) => row.legId);
  }

  private removeFile(filename: string): void {
    const path = join(LEG_PHOTOS_DIR, filename);
    if (existsSync(path)) {
      try {
        unlinkSync(path);
      } catch {
        /* an orphaned file is a cleanup-cron problem, not a request error */
      }
    }
  }
}
