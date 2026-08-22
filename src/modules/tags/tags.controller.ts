import {
  Body,
  Controller,
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

  @ApiOperation({ summary: 'List the tag inventory (admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated list of tags.' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  findAll(@Query() query: TagQueryDto) {
    return this.tagsService.findAll(query);
  }

  @ApiOperation({
    summary: "List tags currently assigned to the caller's own pets",
  })
  @ApiResponse({
    status: 200,
    description: 'Array of tags assigned to the caller.',
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
    summary: 'Create a new tag (admin only)',
    description:
      'Seeds a new tag into inventory as immediately Available, and generates its QR image. ' +
      "The QR image encodes the tag's public code and never changes across reassignments.",
  })
  @ApiResponse({ status: 201, description: 'Tag created.' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateTagDto) {
    return this.tagsService.create(dto);
  }

  @ApiOperation({
    summary: "Assign an available tag to one of the caller's own pets",
  })
  @ApiResponse({ status: 200, description: 'Tag assigned.' })
  @ApiResponse({
    status: 400,
    description: 'Tag is not available, or the pet already has an active tag.',
  })
  @ApiResponse({ status: 404, description: 'Tag or pet not found.' })
  @Post('assign')
  assign(@CurrentUser() user: JwtPayload, @Body() dto: AssignTagDto) {
    return this.tagsService.assign(user.sub, dto);
  }

  @ApiOperation({
    summary: "Unassign a tag from the pet it's currently linked to",
    description:
      'Callable by the owner of the currently-assigned pet, or an admin.',
  })
  @ApiResponse({ status: 200, description: 'Tag unassigned.' })
  @ApiResponse({ status: 400, description: 'Tag is not currently assigned.' })
  @ApiResponse({
    status: 404,
    description: 'Tag not found, or not owned by the caller.',
  })
  @Post('unassign')
  unassign(@CurrentUser() user: JwtPayload, @Body() dto: UnassignTagDto) {
    return this.tagsService.unassign(
      user.sub,
      dto,
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
