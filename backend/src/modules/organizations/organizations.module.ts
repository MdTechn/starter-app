import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { OrganizationScopeService } from './organization-scope.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [PaymentsModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationScopeService],
  exports: [OrganizationsService, OrganizationScopeService],
})
export class OrganizationsModule {}
