import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { STORAGE_PROVIDER } from './storage.constants';
import { LocalDiskStorageProvider } from './providers/local-disk-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: (configService: ConfigService) => {
        return configService.get<string>('storage.provider') === 's3'
          ? new S3StorageProvider(configService)
          : new LocalDiskStorageProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
