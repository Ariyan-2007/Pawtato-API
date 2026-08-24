import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DatingController } from './dating.controller';
import { PetDatingProfileController } from './pet-dating-profile.controller';
import { DatingService } from './dating.service';

import {
  PetDatingProfile,
  PetDatingProfileSchema,
} from './schemas/pet-dating-profile.schema';
import { Swipe, SwipeSchema } from './schemas/swipe.schema';
import { Match, MatchSchema } from './schemas/match.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import {
  DatingReport,
  DatingReportSchema,
} from './schemas/dating-report.schema';

import { PetsModule } from '../pets/pets.module';
import { MedicalModule } from '../medical/medical.module';
import { VaccinationsModule } from '../vaccinations/vaccinations.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PetDatingProfile.name, schema: PetDatingProfileSchema },
      { name: Swipe.name, schema: SwipeSchema },
      { name: Match.name, schema: MatchSchema },
      { name: Message.name, schema: MessageSchema },
      { name: DatingReport.name, schema: DatingReportSchema },
    ]),

    PetsModule,
    MedicalModule,
    VaccinationsModule,
    ActivityModule,
  ],

  controllers: [DatingController, PetDatingProfileController],

  providers: [DatingService],

  exports: [DatingService],
})
export class DatingModule {}
