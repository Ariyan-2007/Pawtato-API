import { Test, TestingModule } from '@nestjs/testing';
import { PushChannel } from './push.channel';
import { NotificationsService } from '../notifications.service';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';

describe('PushChannel', () => {
  let channel: PushChannel;
  let notificationsService: { getDeviceTokens: jest.Mock };

  beforeEach(async () => {
    notificationsService = { getDeviceTokens: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushChannel,
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    channel = module.get<PushChannel>(PushChannel);
  });

  it('should be defined', () => {
    expect(channel).toBeDefined();
  });

  it('does nothing for an event type that does not opt into push, without looking up tokens', async () => {
    await channel.send('user-1', DOMAIN_EVENTS.TAG_ASSIGNED, {
      petName: 'Rex',
    });

    expect(notificationsService.getDeviceTokens).not.toHaveBeenCalled();
  });

  it('does nothing when the user has no registered devices', async () => {
    notificationsService.getDeviceTokens.mockResolvedValue([]);
    const logSpy = jest.spyOn(channel['logger'], 'log');

    await channel.send('user-1', DOMAIN_EVENTS.PET_MARKED_LOST, {
      petName: 'Rex',
    });

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs the stub send for each registered device on an opted-in event type', async () => {
    notificationsService.getDeviceTokens.mockResolvedValue([
      { token: 'a' },
      { token: 'b' },
    ]);
    const logSpy = jest.spyOn(channel['logger'], 'log');

    await channel.send('user-1', DOMAIN_EVENTS.PET_MARKED_LOST, {
      petName: 'Rex',
    });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2 device'));
  });
});
