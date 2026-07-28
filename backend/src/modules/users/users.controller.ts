import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission, UserRole } from '@saas-starter/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import {
  CreateUserDto,
  ListUsersQueryDto,
  UpdateUserProfileDto,
  UpdateUserStatusDto,
} from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current user profile (Prisma + org memberships)' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.findMe(user.sub);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update own profile (name, firstName, lastName, avatar)',
  })
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserProfileDto,
  ) {
    return this.users.updateMe(user.sub, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.USERS_LIST)
  @ApiOperation({ summary: 'List users (search, pagination, filters)' })
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.USERS_WRITE, Permission.IAM_MANAGE)
  @ApiOperation({
    summary:
      'Create local user linked to existing Keycloak identity (no password)',
  })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.USERS_READ, Permission.USERS_LIST)
  @ApiOperation({ summary: 'User detail' })
  findOne(@Param('id') id: string) {
    return this.users.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.USERS_WRITE)
  @ApiOperation({ summary: 'Update user profile fields' })
  update(@Param('id') id: string, @Body() dto: UpdateUserProfileDto) {
    return this.users.updateProfile(id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.USERS_WRITE, Permission.IAM_MANAGE)
  @ApiOperation({ summary: 'Set user status ACTIVE | DISABLED | DELETED' })
  setStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.users.setStatus(id, dto.status);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.IAM_MANAGE)
  @ApiOperation({ summary: 'Soft-delete user (status DELETED)' })
  remove(@Param('id') id: string) {
    return this.users.softDelete(id);
  }
}
