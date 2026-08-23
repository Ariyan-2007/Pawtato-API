import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';

import { STORAGE_PROVIDER } from '../storage/storage.constants';
import type { StorageProvider } from '../storage/interfaces/storage-provider.interface';

@Injectable()
export class QrService {
  constructor(
    private readonly configService: ConfigService,

    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
  ) {}

  // Called once at tag creation; the image stays valid across reassignment since scans resolve tag -> current pet dynamically.
  async generate(publicCode: string) {
    const appUrl = this.configService.get<string>('app.url');
    const qrUrl = `${appUrl}/api/public/tags/${publicCode}`;

    const buffer = await QRCode.toBuffer(qrUrl, {
      width: 400,
    });

    const filename = `${publicCode}.png`;

    const key = await this.storageProvider.upload({
      buffer,
      folder: 'qrcodes',
      originalName: filename,
      mimetype: 'image/png',
      filename,
    });

    return this.storageProvider.getUrl(key);
  }
}
