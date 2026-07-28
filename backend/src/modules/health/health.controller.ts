import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@saas-starter/shared';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return this.health.live();
  }

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe (alias)' })
  liveAlias() {
    return this.health.live();
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (DB required)' })
  async ready() {
    const result = await this.health.ready();
    if (!result.ok) {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }

  /** @deprecated Prefer /health/ready — kept for compatibility. */
  @Public()
  @Get('db')
  @ApiOperation({ summary: 'Database readiness probe (legacy)' })
  async db() {
    const check = await this.health.checkDatabase();
    if (check.status === 'down') {
      throw new ServiceUnavailableException({
        ok: false,
        database: 'down',
        detail: check.detail,
      });
    }
    return { ok: true, database: 'up' };
  }

  @Get('status')
  @ApiBearerAuth()
  @Permissions(Permission.SYSTEM_READ)
  @ApiOperation({ summary: 'Detailed system status (admin)' })
  status() {
    return this.health.detailed();
  }
}
