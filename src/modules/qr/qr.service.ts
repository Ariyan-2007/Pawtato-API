import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class QrService {
  async generate(publicId: string) {
    const folder = path.join(
      process.cwd(),
      'uploads',
      'qrcodes',
    );

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, {
        recursive: true,
      });
    }

    const filename = `${publicId}.png`;

    const filepath = path.join(
      folder,
      filename,
    );

    const qrUrl = `http://localhost:5000/api/public/pets/${publicId}`;

    await QRCode.toFile(
      filepath,
      qrUrl,
      {
        width: 400,
      },
    );

    return `/uploads/qrcodes/${filename}`;
  }
}