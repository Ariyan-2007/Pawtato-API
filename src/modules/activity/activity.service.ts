import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { Activity, ActivityDocument } from './schemas/activity.schema';
import { ActivityQueryDto } from './dto/activity-query.dto';

@Injectable()
export class ActivityService {
  constructor(
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
  ) {}

  async log(
    actor: string,
    action: string,
    target: string,
    metadata: Record<string, any> = {},
  ) {
    return this.activityModel.create({
      actor,
      action,
      target,
      metadata,
    });
  }

  async findAll(query: ActivityQueryDto) {
    const { page, limit, actor, action } = query;

    const filter: Record<string, unknown> = {};

    if (actor) {
      filter.actor = actor;
    }

    if (action) {
      filter.action = action;
    }

    const total = await this.activityModel.countDocuments(filter);

    const activities = await this.activityModel
      .find(filter)
      .populate('actor', 'fullName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      activities,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
