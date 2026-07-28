import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Permission, UserRole } from '@saas-starter/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RequiresFeature } from '../../common/decorators/requires-feature.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AiService } from './ai.service';
import { AiUsageQueryDto, RewriteDto, TranslateDto } from './dto/ai.dto';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  @Permissions(Permission.CMS_READ)
  @ApiOperation({ summary: 'Active AI provider and availability' })
  status() {
    return this.ai.status();
  }

  @Get('usage')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.ADMIN_ACCESS)
  @ApiOperation({
    summary: 'Aggregate AI usage (tokens / requests) — ADMIN only',
  })
  usage(@Query() query: AiUsageQueryDto) {
    return this.ai.getUsage(query);
  }

  @Post('translate')
  @Permissions(Permission.CMS_WRITE, Permission.CMS_MANAGE)
  @RequiresFeature('ai')
  @ApiOperation({
    summary:
      'Preview CMS article translation (does not persist — accept via CMS upsert). Requires plan feature `ai`.',
  })
  translate(@Body() dto: TranslateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ai.translate(dto, user.userId, {
      userId: user.userId,
      roles: user.roles,
    });
  }

  @Post('rewrite')
  @Permissions(Permission.CMS_WRITE, Permission.CMS_MANAGE)
  @RequiresFeature('cms_ai_rewrite')
  @ApiOperation({
    summary:
      'Rewrite text via interchangeable AI provider. Requires plan feature `cms_ai_rewrite`.',
  })
  rewrite(@Body() dto: RewriteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ai.rewrite(dto, user.userId);
  }
}
