import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminUsersService } from './admin-users.service';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [AuthModule, UsersModule, OrganizationsModule],
  controllers: [AdminController],
  providers: [AdminUsersService, InvitationsService],
  exports: [AdminUsersService, InvitationsService],
})
export class AdminModule {}
