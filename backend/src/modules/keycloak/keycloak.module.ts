import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { KeycloakJwtService } from './keycloak-jwt.service';
import { KeycloakUserSyncService } from './keycloak-user-sync.service';
import { KeycloakAuthGuard } from './guards/keycloak-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';

@Global()
@Module({
  imports: [AuthModule],
  providers: [
    KeycloakJwtService,
    KeycloakUserSyncService,
    {
      provide: APP_GUARD,
      useClass: KeycloakAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
  exports: [KeycloakJwtService, KeycloakUserSyncService],
})
export class KeycloakModule {}
