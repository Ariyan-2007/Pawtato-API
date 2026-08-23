import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { AssignTagDto } from './dto/assign-tag.dto';
import { UnassignTagDto } from './dto/unassign-tag.dto';
import { TagQueryDto } from './dto/tag-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Tags')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @ApiOperation({ summary: 'List every tag in the system (admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated list of tags.' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  findAll(@Query() query: TagQueryDto) {
    return this.tagsService.findAll(query);
  }

  @ApiOperation({
    summary: 'List every tag the caller owns, regardless of status',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of tags created by the caller.',
  })
  @Get('mine')
  findMine(@CurrentUser() user: JwtPayload) {
    return this.tagsService.findMine(user.sub);
  }

  @ApiOperation({ summary: 'Get a single tag by ID (admin only)' })
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiResponse({ status: 200, description: 'The tag.' })
  @ApiResponse({ status: 404, description: 'Tag not found.' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tagsService.findOne(id);
  }

  @ApiOperation({
    summary: 'Create a new QR tag, owned by the caller',
    description:
      'Self-service: generates a random public code, builds the full scan-landing URL from the ' +
      'caller-supplied `redirectBaseUrl` plus that code, and renders/stores the QR image encoding it. ' +
      "The tag starts unlinked (`AVAILABLE`) — use assign to link it to one of the caller's pets.",
  })
  @ApiResponse({ status: 201, description: 'Tag created.' })
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTagDto) {
    return this.tagsService.create(user.sub, dto);
  }

  @ApiOperation({
    summary: "Assign the caller's own tag to one of the caller's own pets",
  })
  @ApiResponse({ status: 200, description: 'Tag assigned.' })
  @ApiResponse({
    status: 400,
    description: 'Tag is not available, or the pet already has an active tag.',
  })
  @ApiResponse({ status: 403, description: 'Caller does not own this tag.' })
  @ApiResponse({ status: 404, description: 'Tag or pet not found.' })
  @Post('assign')
  assign(@CurrentUser() user: JwtPayload, @Body() dto: AssignTagDto) {
    return this.tagsService.assign(
      user.sub,
      dto,
      (user.role as UserRole) === UserRole.ADMIN,
    );
  }

  @ApiOperation({
    summary: "Unassign the caller's own tag from the pet it's linked to",
    description: 'Callable by the tag owner, or an admin.',
  })
  @ApiResponse({ status: 200, description: 'Tag unassigned.' })
  @ApiResponse({ status: 400, description: 'Tag is not currently assigned.' })
  @ApiResponse({ status: 403, description: 'Caller does not own this tag.' })
  @ApiResponse({ status: 404, description: 'Tag not found.' })
  @Post('unassign')
  unassign(@CurrentUser() user: JwtPayload, @Body() dto: UnassignTagDto) {
    return this.tagsService.unassign(
      user.sub,
      dto,
      (user.role as UserRole) === UserRole.ADMIN,
    );
  }

  @ApiOperation({
    summary: 'Permanently delete a tag the caller owns',
    description:
      'If the tag is currently linked to a pet, the link is cleared as part of the delete — ' +
      'a scan of the physical sticker afterward resolves to "not linked" rather than the old pet. ' +
      'Callable by the tag owner, or an admin.',
  })
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiResponse({ status: 200, description: 'Tag deleted.' })
  @ApiResponse({ status: 403, description: 'Caller does not own this tag.' })
  @ApiResponse({ status: 404, description: 'Tag not found.' })
  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tagsService.delete(
      user.sub,
      id,
      (user.role as UserRole) === UserRole.ADMIN,
    );
  }

  @ApiOperation({
    summary: 'Suspend a tag, e.g. for reported abuse (admin only)',
  })
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiResponse({ status: 200, description: 'Tag suspended.' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/suspend')
  suspend(@Param('id') id: string) {
    return this.tagsService.suspend(id);
  }

  @ApiOperation({ summary: 'Retire a tag permanently (admin only)' })
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiResponse({ status: 200, description: 'Tag retired.' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/retire')
  retire(@Param('id') id: string) {
    return this.tagsService.retire(id);
  }
}
