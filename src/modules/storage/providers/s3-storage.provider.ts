import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { extname } from 'path';

import {
  StorageProvider,
  StorageUploadInput,
} from '../interfaces/storage-provider.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly publicUrl?: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('storage.s3.bucket') ?? '';
    this.region = this.configService.get<string>('storage.s3.region') ?? '';
    this.publicUrl = this.configService.get<string>('storage.s3.publicUrl');

    this.client = new S3Client({
      region: this.region,
      endpoint: this.configService.get<string>('storage.s3.endpoint'),
      forcePathStyle: this.configService.get<boolean>(
        'storage.s3.forcePathStyle',
      ),
      credentials: {
        accessKeyId:
          this.configService.get<string>('storage.s3.accessKeyId') ?? '',
        secretAccessKey:
          this.configService.get<string>('storage.s3.secretAccessKey') ?? '',
      },
    });
  }

  async upload({
    buffer,
    folder,
    originalName,
    mimetype,
    filename,
  }: StorageUploadInput): Promise<string> {
    const resolvedFilename =
      filename ?? `${Date.now()}-${randomUUID()}${extname(originalName)}`;

    const key = `${folder}/${resolvedFilename}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      }),
    );

    return key;
  }

  getUrl(key: string): string {
    if (this.publicUrl) {
      return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
    }

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
