import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PublicController } from './public.controller';
import { PublicService } from './public.service';

import { Pet, PetSchema } from '../pets/schemas/pet.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Pet.name,
        schema: PetSchema,
      },
    ]),
  ],

  controllers: [PublicController],

  providers: [PublicService],
})
export class PublicModule {}