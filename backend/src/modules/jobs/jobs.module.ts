import { Global, Module, OnModuleInit } from '@nestjs/common';
import { AppLogger } from '../../common/logger/app-logger.service';
import { JobsService, JOB_QUEUES } from './jobs.service';

@Global()
@Module({
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule implements OnModuleInit {
  constructor(
    private readonly jobs: JobsService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(JobsModule.name);
  }

  onModuleInit() {
    // Default ping job handler (smoke / health of queue pipeline).
    this.jobs.registerHandler(JOB_QUEUES.DEFAULT, async (data) => {
      this.logger.debug(`Default job processed: ${JSON.stringify(data ?? {})}`);
    });
  }
}

export { JobsService, JOB_QUEUES } from './jobs.service';
