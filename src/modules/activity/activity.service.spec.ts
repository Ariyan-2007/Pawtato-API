import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { ActivityService } from './activity.service';
import { Activity } from './schemas/activity.schema';

describe('ActivityService', () => {
  let service: ActivityService;
  let activityModel: {
    create: jest.Mock;
    find: jest.Mock;
    countDocuments: jest.Mock;
  };

  beforeEach(async () => {
    activityModel = {
      create: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        { provide: getModelToken(Activity.name), useValue: activityModel },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('persists actor/action/target/metadata', async () => {
      activityModel.create.mockResolvedValue({});

      await service.log('actor-1', 'admin.user.blocked', 'user-1', {
        reason: 'abuse',
      });

      expect(activityModel.create).toHaveBeenCalledWith({
        actor: 'actor-1',
        action: 'admin.user.blocked',
        target: 'user-1',
        metadata: { reason: 'abuse' },
      });
    });

    it('defaults metadata to an empty object when omitted', async () => {
      activityModel.create.mockResolvedValue({});

      await service.log('actor-1', 'tag.assigned', 'tag-1');

      expect(activityModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: {} }),
      );
    });
  });

  describe('findAll', () => {
    it('paginates and filters by actor/action when provided', async () => {
      const limit = jest.fn().mockResolvedValue([]);
      const skip = jest.fn().mockReturnValue({ limit });
      const sort = jest.fn().mockReturnValue({ skip });
      const populate = jest.fn().mockReturnValue({ sort });
      activityModel.find.mockReturnValue({ populate });

      const result = await service.findAll({
        page: 2,
        limit: 5,
        actor: 'actor-1',
        action: 'tag.suspended',
      });

      expect(activityModel.find).toHaveBeenCalledWith({
        actor: 'actor-1',
        action: 'tag.suspended',
      });
      expect(skip).toHaveBeenCalledWith(5);
      expect(limit).toHaveBeenCalledWith(5);
      expect(result.pagination).toEqual({
        total: 0,
        page: 2,
        limit: 5,
        totalPages: 0,
      });
    });

    it('applies no filter when actor/action are omitted', async () => {
      const limit = jest.fn().mockResolvedValue([]);
      const skip = jest.fn().mockReturnValue({ limit });
      const sort = jest.fn().mockReturnValue({ skip });
      const populate = jest.fn().mockReturnValue({ sort });
      activityModel.find.mockReturnValue({ populate });

      await service.findAll({ page: 1, limit: 20 });

      expect(activityModel.find).toHaveBeenCalledWith({});
    });
  });
});
