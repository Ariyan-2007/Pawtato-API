import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import configuration from './config/configuration';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PetsModule } from './modules/pets/pets.module';
import { PublicModule } from './modules/public/public.module';
import { QrModule } from './modules/qr/qr.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    ServeStaticModule.forRoot({
     rootPath: join(process.cwd(), 'uploads'),
     serveRoot: '/uploads',
    }),

    DatabaseModule,

    HealthModule,

    AuthModule,

    UsersModule,

    PetsModule,

    PublicModule,

    QrModule,
  ],
})
export class AppModule {}