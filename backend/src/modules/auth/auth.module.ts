import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthAuditService } from './auth-audit.service';

@Module({
  controllers: [AuthController],
  providers: [AuthAuditService],
  exports: [AuthAuditService],
})
export class AuthModule {}
