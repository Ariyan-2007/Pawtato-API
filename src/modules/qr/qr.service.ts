import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class QrService {
  constructor(private readonly configService: ConfigService) {}

  // Called once at tag creation; the image stays valid across reassignment since scans resolve tag -> current pet dynamically.
  async generate(publicCode: string) {
    const folder = path.join(process.cwd(), 'uploads', 'qrcodes');

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, {
        recursive: true,
      });
    }

    const filename = `${publicCode}.png`;

    const filepath = path.join(folder, filename);

    const appUrl = this.configService.get<string>('app.url');
    const qrUrl = `${appUrl}/api/public/tags/${publicCode}`;

    await QRCode.toFile(filepath, qrUrl, {
      width: 400,
    });

    return `/uploads/qrcodes/${filename}`;
  }
}
