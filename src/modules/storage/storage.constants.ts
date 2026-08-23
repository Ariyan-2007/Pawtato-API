import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export function imageFileFilter(
  req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
    callback(
      new BadRequestException('File must be a JPEG, PNG, or WebP image'),
      false,
    );
    return;
  }

  callback(null, true);
}
