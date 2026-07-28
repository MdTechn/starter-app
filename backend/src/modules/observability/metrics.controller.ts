import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiExcludeController, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@ApiTags('observability')
@ApiExcludeController()
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get('metrics')
  @ApiOperation({ summary: 'Prometheus metrics scrape endpoint' })
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(@Res({ passthrough: true }) res: Response) {
    const body = await this.metrics.metricsText();
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return body;
  }
}
