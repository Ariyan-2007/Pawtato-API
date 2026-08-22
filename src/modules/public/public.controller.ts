import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

import { PublicService } from './public.service';
import { CreateFoundReportDto } from '../found-reports/dto/create-found-report.dto';

const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@ApiTags('Public')
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @ApiOperation({
    summary: "Get a pet's public profile by its tag's public code",
    description:
      'No authentication required. This is the page a QR-code scan resolves to. ' +
      'If the tag is not currently linked to a pet (or is suspended/retired), returns a ' +
      'status message instead of a pet profile. Never returns owner-private information ' +
      '(password, internal IDs, unshared contact details).',
  })
  @ApiResponse({
    status: 200,
    description: 'Public pet profile, or a tag-status message.',
  })
  @ApiResponse({
    status: 404,
    description: 'No tag found for this public code.',
  })
  @Throttle({ public: { limit: 20, ttl: 60_000 } })
  @Get('tags/:publicCode')
  getPetProfile(
    @Param('publicCode')
    publicCode: string,

    @Headers('user-agent')
    userAgent?: string,
  ) {
    return this.publicService.getPetProfile(publicCode, userAgent);
  }

  @ApiOperation({
    summary: 'List pets currently reported lost',
    description: 'No authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of lost pets with public-safe fields only.',
  })
  @Throttle({ public: { limit: 20, ttl: 60_000 } })
  @Get('lost-pets')
  getLostPets() {
    return this.publicService.getLostPets();
  }

  @ApiOperation({
    summary: "Report a found pet by its tag's public code",
    description:
      'No authentication required. Lets a finder notify the owner without creating an account.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        approxLocation: { type: 'string' },
        contactInfo: { type: 'string' },
        photo: { type: 'string', format: 'binary' },
      },
      required: ['message'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Found report submitted; the owner is notified.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed, or the tag is not linked to a pet.',
  })
  @ApiResponse({
    status: 404,
    description: 'No tag found for this public code.',
  })
  @Throttle({ write: { limit: 5, ttl: 60_000 } })
  @Post('tags/:publicCode/found-report')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: './uploads/found-reports',
        filename: (req, file, callback) => {
          const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);

          callback(null, uniqueName + extname(file.originalname));
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (req, file, callback) => {
        if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.mimetype)) {
          callback(
            new BadRequestException('Photo must be a JPEG, PNG, or WebP image'),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  async submitFoundReport(
    @Param('publicCode')
    publicCode: string,

    @Body()
    dto: CreateFoundReportDto,

    @UploadedFile()
    file?: Express.Multer.File,
  ) {
    const photoUrl = file
      ? `/uploads/found-reports/${file.filename}`
      : undefined;

    return this.publicService.submitFoundReport(publicCode, dto, photoUrl);
  }
}
