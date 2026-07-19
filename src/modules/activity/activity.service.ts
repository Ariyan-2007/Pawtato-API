import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  Activity,
  ActivityDocument,
} from './schemas/activity.schema';

@Injectable()
export class ActivityService {
  constructor(
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
  ) {}

  async log(
    admin: string,
    action: string,
    target: string,
    metadata: Record<string, any> = {},
  ) {
    return this.activityModel.create({
      admin,
      action,
      target,
      metadata,
    });
  }

  async findAll() {
    return this.activityModel
      .find()
      .populate(
        'admin',
        'fullName email',
      )
      .sort({
        createdAt: -1,
      });
  }
}