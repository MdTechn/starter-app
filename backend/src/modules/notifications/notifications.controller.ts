import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@saas-starter/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { NotificationsService } from './notifications.service';
import { NotificationTemplateService } from './notification-template.service';
import { UpdatePreferenceDto } from './dto/notifications.dto';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly templates: NotificationTemplateService,
  ) {}

  @Get()
  @Permissions(Permission.NOTIFICATION_READ)
  @ApiOperation({ summary: 'List in-app notifications for current user' })
  list(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    const userId = this.requireUserId(user);
    const parsed = limit ? Number(limit) : 50;
    return this.notifications.listForUser(
      userId,
      Number.isFinite(parsed) ? parsed : 50,
    );
  }

  @Get('unread-count')
  @Permissions(Permission.NOTIFICATION_READ)
  @ApiOperation({ summary: 'Unread in-app notification count' })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications
      .unreadCount(this.requireUserId(user))
      .then((count) => ({ count }));
  }

  @Patch('read-all')
  @Permissions(Permission.NOTIFICATION_READ)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(this.requireUserId(user));
  }

  @Get('preferences')
  @Permissions(Permission.NOTIFICATION_READ)
  @ApiOperation({ summary: 'Get notification preferences' })
  preferences(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.getPreferences(this.requireUserId(user));
  }

  @Patch('preferences')
  @Permissions(Permission.NOTIFICATION_READ)
  @ApiOperation({ summary: 'Update a notification preference' })
  updatePreference(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferenceDto,
  ) {
    return this.notifications.upsertPreference(
      this.requireUserId(user),
      dto.eventType,
      dto,
    );
  }

  @Get('templates')
  @Permissions(Permission.NOTIFICATION_MANAGE)
  @ApiOperation({ summary: 'List notification templates (admin)' })
  listTemplates() {
    return this.templates.list();
  }

  @Patch(':id/read')
  @Permissions(Permission.NOTIFICATION_READ)
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notifications.markRead(this.requireUserId(user), id);
  }

  private requireUserId(user: AuthenticatedUser): string {
    if (!user.userId) {
      throw new ForbiddenException('User not synced');
    }
    return user.userId;
  }
}
