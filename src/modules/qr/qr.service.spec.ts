import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QrService } from './qr.service';

describe('QrService', () => {
  let service: QrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QrService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:5000') },
        },
      ],
    }).compile();

    service = module.get<QrService>(QrService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
