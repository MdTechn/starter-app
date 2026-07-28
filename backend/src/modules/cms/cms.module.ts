import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { StorageModule } from '../storage/storage.module';
import { CmsController } from './cms.controller';
import { CmsFoldersService } from './cms-folders.service';
import { CmsArticlesService } from './cms-articles.service';

@Module({
  imports: [StorageModule, OrganizationsModule],
  controllers: [CmsController],
  providers: [CmsFoldersService, CmsArticlesService],
  exports: [CmsFoldersService, CmsArticlesService],
})
export class CmsModule {}
