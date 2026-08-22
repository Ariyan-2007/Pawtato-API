import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';
import { Tag, TagSchema } from './schemas/tag.schema';

import { PetsModule } from '../pets/pets.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Tag.name,
        schema: TagSchema,
      },
    ]),

    PetsModule,
  ],

  controllers: [TagsController],

  providers: [TagsService],

  exports: [MongooseModule, TagsService],
})
export class TagsModule {}
