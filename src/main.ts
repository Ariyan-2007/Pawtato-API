import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as express from 'express';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.use(
  '/uploads',
  express.static(
    join(process.cwd(), 'uploads'),
     ),
   );
    
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

  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT || 5000);

  console.log(
    `🚀 Pawtato API running on http://localhost:${process.env.PORT || 5000}`,
  );

  console.log(
    `📚 Swagger Docs: http://localhost:${process.env.PORT || 5000}/api/docs`,
  );
}

bootstrap();