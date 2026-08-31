import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { LandingPageController } from './landing-page.controller';
import { LandingPageService } from './landing-page.service';

import { LandingPage, LandingPageSchema } from './schemas/landing-page.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: LandingPage.name,
        schema: LandingPageSchema,
      },
    ]),
  ],

  controllers: [LandingPageController],

  providers: [LandingPageService],

  exports: [LandingPageService],
})
export class LandingPageModule {}
