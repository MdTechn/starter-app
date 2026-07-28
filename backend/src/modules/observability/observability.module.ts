import { Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { OtelService } from './otel.service';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, OtelService],
  exports: [MetricsService, OtelService],
})
export class ObservabilityModule {}
