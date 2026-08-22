import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as express from 'express';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { winstonLogger } from './config/logger.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: winstonLogger,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 5000;
  const apiPrefix = configService.get<string>('app.apiPrefix') ?? 'api';
  const appUrl = configService.get<string>('app.url');
  const corsOrigins = configService.get<string[]>('app.corsOrigins') ?? [];

  app.use(helmet());

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
  });

  app.setGlobalPrefix(apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Pawtato API')
    .setDescription('Digital Identity Platform for Pets')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  await app.listen(port);

  console.log(`🚀 Pawtato API running on ${appUrl}`);
  console.log(`📚 Swagger Docs: ${appUrl}/${apiPrefix}/docs`);
}

void bootstrap();
