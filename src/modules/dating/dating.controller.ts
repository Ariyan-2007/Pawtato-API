import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { DatingService } from './dating.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DiscoverQueryDto } from './dto/discover-query.dto';
import { SwipeDto } from './dto/swipe.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateDatingReportDto } from './dto/create-dating-report.dto';

@ApiTags('Dating')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('dating')
export class DatingController {
  constructor(private readonly datingService: DatingService) {}

  @ApiOperation({
    summary: 'Discover candidate pets to swipe on',
    description:
      'Same species as the swiping pet, purpose-compatible, excludes the ' +
      "caller's own pets and anything already swiped, active profiles only.",
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of candidate profiles.',
  })
  @ApiResponse({
    status: 400,
    description: 'The swiping pet has no active dating profile.',
  })
  @Get('discover')
  discover(@CurrentUser() user: JwtPayload, @Query() query: DiscoverQueryDto) {
    return this.datingService.discover(user.sub, query);
  }

  @ApiOperation({
    summary: 'Swipe on another pet',
    description:
      'A mutual LIKE immediately creates and returns a Match — no polling needed. ' +
      'Species and purpose compatibility are enforced here too, not just in discover().',
  })
  @ApiResponse({
    status: 201,
    description:
      'Swipe recorded; `match` is non-null only on a new mutual LIKE.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Already swiped on this pet, incompatible species/purpose, or an inactive profile.',
  })
  @Throttle({ swipe: { limit: 60, ttl: 60_000 } })
  @Post('swipe')
  swipe(@CurrentUser() user: JwtPayload, @Body() dto: SwipeDto) {
    return this.datingService.swipe(user.sub, dto);
  }

  @ApiOperation({ summary: "List all of the caller's active matches" })
  @ApiResponse({ status: 200, description: 'Array of active matches.' })
  @Get('matches')
  listMatches(@CurrentUser() user: JwtPayload) {
    return this.datingService.listMatches(user.sub);
  }

  @ApiOperation({ summary: 'List messages in a match' })
  @ApiParam({ name: 'matchId', description: 'Match ID' })
  @ApiResponse({ status: 200, description: 'Messages, oldest first.' })
  @ApiResponse({
    status: 404,
    description: 'Match not found, or the caller owns neither side.',
  })
  @Get('matches/:matchId/messages')
  listMessages(
    @CurrentUser() user: JwtPayload,
    @Param('matchId', ParseMongoIdPipe) matchId: string,
  ) {
    return this.datingService.listMessages(user.sub, matchId);
  }

  @ApiOperation({ summary: 'Send a message in a match' })
  @ApiParam({ name: 'matchId', description: 'Match ID' })
  @ApiResponse({ status: 201, description: 'Message sent.' })
  @ApiResponse({ status: 400, description: 'This match has already ended.' })
  @ApiResponse({
    status: 404,
    description: 'Match not found, or the caller owns neither side.',
  })
  @Post('matches/:matchId/messages')
  sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('matchId', ParseMongoIdPipe) matchId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.datingService.sendMessage(user.sub, matchId, dto);
  }

  @ApiOperation({ summary: 'Unmatch — either side can end it' })
  @ApiParam({ name: 'matchId', description: 'Match ID' })
  @ApiResponse({ status: 201, description: 'Unmatched successfully.' })
  @ApiResponse({
    status: 404,
    description: 'Match not found, or the caller owns neither side.',
  })
  @Post('matches/:matchId/unmatch')
  unmatch(
    @CurrentUser() user: JwtPayload,
    @Param('matchId', ParseMongoIdPipe) matchId: string,
  ) {
    return this.datingService.unmatch(user.sub, matchId);
  }

  @ApiOperation({ summary: "Report a pet's dating profile" })
  @ApiResponse({ status: 201, description: 'Report submitted.' })
  @ApiResponse({
    status: 404,
    description: 'Pet not found, or it has no dating profile.',
  })
  @Post('report')
  report(@CurrentUser() user: JwtPayload, @Body() dto: CreateDatingReportDto) {
    return this.datingService.report(user.sub, dto);
  }
}
