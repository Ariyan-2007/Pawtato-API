import { Test, TestingModule } from '@nestjs/testing';
import { DomainEventsListener } from './domain-events.listener';
import { NotificationsService } from '../notifications.service';
import { NOTIFICATION_CHANNELS } from '../notifications.constants';

describe('DomainEventsListener', () => {
  let listener: DomainEventsListener;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomainEventsListener,
        { provide: NotificationsService, useValue: {} },
        { provide: NOTIFICATION_CHANNELS, useValue: [] },
      ],
    }).compile();

    listener = module.get<DomainEventsListener>(DomainEventsListener);
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });
});
