import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { existsSync, readFileSync, renameSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import sharp, { type Sharp } from 'sharp';

/**
 * Image upload pipeline, ported from ia-fitness-app (2026-08-14) — the
 * proven pattern the owner pointed at. Handles:
 *
 *  1. Magic-byte validation so a file with a spoofed Content-Type cannot
 *     sneak past the multer MIME filter.
 *  2. Resize + format conversion via sharp. `.rotate()` first applies the
 *     EXIF orientation, then sharp's default metadata strip drops EXIF
 *     entirely — including GPS, which must never survive an upload to a
 *     travel app.
 *  3. Write-to-tmp-then-rename (sharp cannot read and write one path).
 *  4. Cleanup of every intermediate file on success and failure.
 *
 * myContrail additions over the original: an explicit input-pixel ceiling
 * (a 2GB droplet must reject a decompression bomb before decoding it) and
 * serialized processing (see LegPhotosService) so concurrent uploads
 * cannot stack RAM spikes.
 */

export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type SupportedImageMimeType =
  (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

const IMAGE_MAGIC_BYTES: Record<SupportedImageMimeType, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
};

/** ~50MP: comfortably above any phone camera, far below a decode bomb. */
const MAX_INPUT_PIXELS = 50_000_000;

export interface ImageProcessingOptions {
  width: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  withoutEnlargement?: boolean;
  format: 'jpeg' | 'webp' | 'png';
  quality?: number;
}

export interface ProcessedImageResult {
  filename: string;
  absolutePath: string;
}

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);

  validateMagicBytes(file: Express.Multer.File): boolean {
    const expected = IMAGE_MAGIC_BYTES[file.mimetype as SupportedImageMimeType];
    if (!expected) return false;
    try {
      const buffer = readFileSync(file.path);
      return expected.every((byte, i) => buffer[i] === byte);
    } catch (err) {
      this.logger.warn(
        `Magic byte check failed to read ${file.path}: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
      return false;
    }
  }

  async processUpload(
    file: Express.Multer.File,
    options: ImageProcessingOptions,
  ): Promise<ProcessedImageResult> {
    if (!this.validateMagicBytes(file)) {
      this.cleanup(file.path);
      throw new BadRequestException(
        'Invalid image file. Only JPEG, PNG, and WebP are allowed.',
      );
    }

    const dir = dirname(file.path);
    const extension = options.format === 'jpeg' ? 'jpg' : options.format;
    const compressedName = file.filename.replace(/\.[^.]+$/, `.${extension}`);
    const compressedPath = join(dir, compressedName);
    const tempPath = join(dir, `tmp-${compressedName}`);

    const pipeline = sharp(file.path, { limitInputPixels: MAX_INPUT_PIXELS })
      // Apply EXIF orientation as pixels, then let the default strip drop
      // the metadata itself (GPS included).
      .rotate()
      .resize(options.width, options.height, {
        fit: options.fit ?? 'inside',
        withoutEnlargement: options.withoutEnlargement ?? true,
      });

    try {
      await this.applyFormat(pipeline, options).toFile(tempPath);
    } catch (err) {
      this.cleanup(file.path);
      this.cleanup(tempPath);
      throw new BadRequestException(
        `Failed to process image: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
    }

    this.cleanup(file.path);
    if (existsSync(compressedPath)) this.cleanup(compressedPath);
    renameSync(tempPath, compressedPath);

    return { filename: compressedName, absolutePath: compressedPath };
  }

  private applyFormat(
    pipeline: Sharp,
    options: ImageProcessingOptions,
  ): Sharp {
    switch (options.format) {
      case 'jpeg':
        return pipeline.jpeg({ quality: options.quality ?? 80 });
      case 'webp':
        return pipeline.webp({ quality: options.quality ?? 80 });
      case 'png':
        return pipeline.png();
    }
  }

  private cleanup(path: string): void {
    if (existsSync(path)) {
      try {
        unlinkSync(path);
      } catch (err) {
        this.logger.warn(
          `Failed to clean up ${path}: ${
            err instanceof Error ? err.message : 'unknown error'
          }`,
        );
      }
    }
  }
}
