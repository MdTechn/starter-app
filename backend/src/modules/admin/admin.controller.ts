import {
  Body,
  Controller,
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
import { AuthAuditService } from '../auth/auth-audit.service';
import { ListUsersQueryDto } from '../users/dto/users.dto';
import { AdminUsersService } from './admin-users.service';
import {
  CreateInvitationDto,
  ListInvitationsQueryDto,
  SetRolesDto,
} from './dto/admin.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminUsers: AdminUsersService,
    private readonly invitations: InvitationsService,
    private readonly audit: AuthAuditService,
  ) {}

  @Get('users')
  @Permissions(Permission.IAM_MANAGE, Permission.USERS_LIST)
  @ApiOperation({ summary: 'List users (search, pagination, filters)' })
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminUsers.listUsers(query);
  }

  @Get('users/:id')
  @Permissions(Permission.IAM_MANAGE, Permission.USERS_READ)
  @ApiOperation({ summary: 'Get user with resolved permissions' })
  getUser(@Param('id') id: string) {
    return this.adminUsers.getUser(id);
  }

  @Patch('users/:id/disable')
  @Permissions(Permission.IAM_MANAGE)
  @ApiOperation({ summary: 'Disable user account' })
  disable(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.adminUsers.disableUser(id, actor.userId);
  }

  @Patch('users/:id/enable')
  @Permissions(Permission.IAM_MANAGE)
  @ApiOperation({ summary: 'Enable / reactivate user account' })
  enable(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.adminUsers.enableUser(id, actor.userId);
  }

  @Patch('users/:id/deleted-from-idp')
  @Permissions(Permission.IAM_MANAGE)
  @ApiOperation({
    summary: 'Mark local user as DELETED when removed from Keycloak',
  })
  deletedFromIdp(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.adminUsers.markDeletedFromIdp(id, actor.userId);
  }

  @Patch('users/:id/roles')
  @Permissions(Permission.IAM_MANAGE)
  @ApiOperation({ summary: 'Update application roles for a user' })
  setRoles(
    @Param('id') id: string,
    @Body() body: SetRolesDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.adminUsers.setRoles(id, body.roles, actor.userId);
  }

  @Get('roles/permissions')
  @Permissions(Permission.IAM_MANAGE, Permission.ADMIN_ACCESS)
  @ApiOperation({ summary: 'Central role → permission mapping' })
  rolePermissions() {
    return this.adminUsers.listRolePermissions();
  }

  @Get('audit')
  @Permissions(Permission.AUDIT_READ)
  @ApiOperation({ summary: 'Recent auth audit events' })
  auditLogs(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 50;
    return this.audit.listRecent(Number.isFinite(parsed) ? parsed : 50);
  }

  @Get('invitations')
  @Permissions(Permission.USERS_INVITE, Permission.IAM_MANAGE)
  @ApiOperation({ summary: 'List user invitations (prep)' })
  listInvitations(@Query() query: ListInvitationsQueryDto) {
    return this.invitations.list(query);
  }

  @Post('invitations')
  @Permissions(Permission.USERS_INVITE, Permission.IAM_MANAGE)
  @ApiOperation({
    summary: 'Create user invitation and send email via SMTP (USER_INVITED)',
  })
  createInvitation(
    @Body() dto: CreateInvitationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.invitations.create(dto, actor.userId);
  }

  @Patch('invitations/:id/revoke')
  @Permissions(Permission.USERS_INVITE, Permission.IAM_MANAGE)
  @ApiOperation({ summary: 'Revoke a pending invitation' })
  revokeInvitation(@Param('id') id: string) {
    return this.invitations.revoke(id);
  }
}
