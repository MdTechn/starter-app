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
  AddOrganizationMemberDto,
  AcceptInvitationDto,
  CreateOrganizationDto,
  UpdateOrganizationDto,
  UpdateOrganizationMemberRoleDto,
} from './dto/organizations.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @Permissions(Permission.ORG_READ)
  @ApiOperation({
    summary: 'List organizations (admin: all; others: memberships only)',
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.organizations.list(user.userId, user.roles);
  }

  @Get('invitations/preview')
  @Permissions(Permission.ORG_READ, Permission.AUTH_ME)
  @ApiOperation({ summary: 'Preview invitation by token (before accept)' })
  previewInvitation(@Query('token') token: string) {
    return this.organizations.getInvitationByToken(token);
  }

  @Post('invitations/accept')
  @Permissions(Permission.ORG_READ, Permission.AUTH_ME)
  @ApiOperation({
    summary: 'Accept invitation by token (email must match current user)',
  })
  acceptInvitation(
    @Body() dto: AcceptInvitationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizations.acceptInvitation(dto.token, user.userId!);
  }

  @Get(':id')
  @Permissions(Permission.ORG_READ)
  @ApiOperation({ summary: 'Organization detail + members (org-scoped)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organizations.findById(id, user.userId, user.roles);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.ORG_MANAGE, Permission.ORG_WRITE)
  @ApiOperation({ summary: 'Create organization' })
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizations.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.ORG_MANAGE, Permission.ORG_WRITE)
  @ApiOperation({ summary: 'Update organization' })
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizations.update(id, dto);
  }

  @Post(':id/members')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.ORG_MANAGE)
  @ApiOperation({
    summary: 'Add organization member (enforces plan memberLimit)',
  })
  addMember(@Param('id') id: string, @Body() dto: AddOrganizationMemberDto) {
    return this.organizations.addMember(id, dto);
  }

  @Patch(':id/members/:userId')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.ORG_MANAGE)
  @ApiOperation({ summary: 'Update member role within organization' })
  updateMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateOrganizationMemberRoleDto,
  ) {
    return this.organizations.updateMemberRole(id, userId, dto);
  }

  @Delete(':id/members/:userId')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.ORG_MANAGE)
  @ApiOperation({ summary: 'Remove organization member' })
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.organizations.removeMember(id, userId);
  }
}
