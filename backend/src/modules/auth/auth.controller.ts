import { Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthAuditEvent, IdentityProvider } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import {
  extractClientIp,
  extractUserAgent,
} from '../../common/utils/request-meta';
import { AuthAuditService } from './auth-audit.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly audit: AuthAuditService) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated user (from Keycloak token)' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return {
      sub: user.sub,
      email: user.email,
      name: user.name,
      roles: user.roles,
      permissions: user.permissions,
      userId: user.userId,
      provider: user.provider ?? 'keycloak',
    };
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Record logout audit (client still clears session)',
  })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    await this.audit.record({
      event: AuthAuditEvent.LOGOUT,
      userId: user.userId,
      provider: IdentityProvider.KEYCLOAK,
      ip: extractClientIp(request),
      userAgent: extractUserAgent(request),
      metadata: { sub: user.sub },
    });
    return { ok: true };
  }

  @Post('token-refresh')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Record TOKEN_REFRESH audit after OIDC refresh (optional)',
  })
  async tokenRefresh(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    await this.audit.record({
      event: AuthAuditEvent.TOKEN_REFRESH,
      userId: user.userId,
      provider: IdentityProvider.KEYCLOAK,
      ip: extractClientIp(request),
      userAgent: extractUserAgent(request),
      metadata: { sub: user.sub },
    });
    return { ok: true };
  }
}
