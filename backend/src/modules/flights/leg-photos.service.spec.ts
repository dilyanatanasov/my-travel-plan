import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { LegPhotosService } from './leg-photos.service';
import { LegPhoto } from './entities/leg-photo.entity';
import { FlightLeg } from './entities/flight-leg.entity';
import { ImageProcessingService } from '../../common/services/image-processing.service';

/**
 * The ownership gate and the one-per-stop replace semantics — the two rules
 * that make photos private and bounded. Repos and the image pipeline are
 * mocked; file cleanup is exercised through the replace path.
 */

describe('LegPhotosService', () => {
  let photoRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  let legRepo: { findOne: jest.Mock };
  let imageProcessing: { processUpload: jest.Mock };
  let service: LegPhotosService;

  const file = { path: '/tmp/x', filename: 'x.jpg' } as Express.Multer.File;

  beforeEach(() => {
    photoRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn((v) => v),
      delete: jest.fn(),
    };
    legRepo = { findOne: jest.fn() };
    imageProcessing = {
      processUpload: jest.fn().mockResolvedValue({
        filename: 'out.jpg',
        absolutePath: '/uploads/leg-photos/out.jpg',
      }),
    };
    service = new LegPhotosService(
      photoRepo as unknown as Repository<LegPhoto>,
      legRepo as unknown as Repository<FlightLeg>,
      imageProcessing as unknown as ImageProcessingService,
    );
  });

  const ownedLeg = () => ({ id: 5, journey: { userId: 7 } });
  const foreignLeg = () => ({ id: 5, journey: { userId: 99 } });

  it('404s an upload to someone else’s stop — never a 403', async () => {
    legRepo.findOne.mockResolvedValue(foreignLeg());
    await expect(service.upload(7, 5, file)).rejects.toThrow(
      NotFoundException,
    );
    expect(imageProcessing.processUpload).not.toHaveBeenCalled();
  });

  it('rejects a missing file before touching anything', async () => {
    await expect(
      service.upload(7, 5, undefined as unknown as Express.Multer.File),
    ).rejects.toThrow(BadRequestException);
    expect(legRepo.findOne).not.toHaveBeenCalled();
  });

  it('stores a photo for the owner', async () => {
    legRepo.findOne.mockResolvedValue(ownedLeg());
    photoRepo.findOne.mockResolvedValue(null);
    await service.upload(7, 5, file);
    expect(photoRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ legId: 5, userId: 7, filename: 'out.jpg' }),
    );
  });

  it('replaces the existing photo — one per stop is the schema, and the row', async () => {
    legRepo.findOne.mockResolvedValue(ownedLeg());
    photoRepo.findOne.mockResolvedValue({ id: 3, filename: 'old.jpg' });
    await service.upload(7, 5, file);
    expect(photoRepo.delete).toHaveBeenCalledWith(3);
    expect(photoRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'out.jpg' }),
    );
  });

  it('streams only rows scoped to the requesting user', async () => {
    photoRepo.findOne.mockResolvedValue(null);
    await expect(service.stream(7, 5)).rejects.toThrow(NotFoundException);
    expect(photoRepo.findOne).toHaveBeenCalledWith({
      where: { legId: 5, userId: 7 },
    });
  });

  it('deletes only the owner’s photo', async () => {
    photoRepo.findOne.mockResolvedValue(null);
    await expect(service.remove(7, 5)).rejects.toThrow(NotFoundException);
    expect(photoRepo.delete).not.toHaveBeenCalled();
  });
});
