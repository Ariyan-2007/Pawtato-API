import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  StorageProvider,
  StorageUploadInput,
} from '../interfaces/storage-provider.interface';

@Injectable()
export class LocalDiskStorageProvider implements StorageProvider {
  private readonly root = path.join(process.cwd(), 'uploads');

  async upload({
    buffer,
    folder,
    originalName,
    filename,
  }: StorageUploadInput): Promise<string> {
    const dir = path.join(this.root, folder);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const resolvedFilename =
      filename ?? `${Date.now()}-${randomUUID()}${path.extname(originalName)}`;

    const key = `${folder}/${resolvedFilename}`;

    await fs.promises.writeFile(path.join(this.root, key), buffer);

    return key;
  }

  getUrl(key: string): string {
    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.promises.unlink(path.join(this.root, key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
