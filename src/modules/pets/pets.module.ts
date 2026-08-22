import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PetsController } from './pets.controller';
import { PetsService } from './pets.service';

import { Pet, PetSchema } from './schemas/pet.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Pet.name,
        schema: PetSchema,
      },
    ]),
  ],

  controllers: [PetsController],

  providers: [PetsService],

  exports: [MongooseModule, PetsService],
})
export class PetsModule {}
