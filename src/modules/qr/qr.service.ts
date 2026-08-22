import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class QrService {
  constructor(private readonly configService: ConfigService) {}

  async generate(publicId: string) {
    const folder = path.join(process.cwd(), 'uploads', 'qrcodes');

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, {
        recursive: true,
      });
    }

    const filename = `${publicId}.png`;

    const filepath = path.join(folder, filename);

    const appUrl = this.configService.get<string>('app.url');
    const qrUrl = `${appUrl}/api/public/pets/${publicId}`;

    await QRCode.toFile(filepath, qrUrl, {
      width: 400,
    });

    return `/uploads/qrcodes/${filename}`;
  }
}
