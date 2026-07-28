import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@saas-starter/shared';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CmsFoldersService, OrgActor } from './cms-folders.service';
import { CmsArticlesService } from './cms-articles.service';
import {
  AttachCmsFileDto,
  CreateCmsArticleDto,
  CreateCmsFolderDto,
  ListCmsArticlesQueryDto,
  RollbackCmsVersionDto,
  UpdateCmsArticleDto,
  UpdateCmsFolderDto,
  UpsertCmsTranslationDto,
} from './dto/cms.dto';

function toActor(user: AuthenticatedUser): OrgActor {
  return { userId: user.userId, roles: user.roles };
}

@ApiTags('cms')
@ApiBearerAuth()
@Controller('cms')
export class CmsController {
  constructor(
    private readonly folders: CmsFoldersService,
    private readonly articles: CmsArticlesService,
  ) {}

  // ——— Folders ———

  @Get('folders')
  @Permissions(Permission.CMS_READ)
  @ApiOperation({ summary: 'List CMS folders (flat) — scoped by organization' })
  listFolders(
    @CurrentUser() user: AuthenticatedUser,
    @Query('tree') tree?: string,
  ) {
    const actor = toActor(user);
    if (tree === '1' || tree === 'true') {
      return this.folders.listTree(actor);
    }
    return this.folders.listFlat(actor);
  }

  @Get('folders/:id')
  @Permissions(Permission.CMS_READ)
  @ApiOperation({ summary: 'CMS folder detail + children' })
  getFolder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.folders.findById(id, toActor(user));
  }

  @Post('folders')
  @Permissions(Permission.CMS_WRITE, Permission.CMS_MANAGE)
  @ApiOperation({ summary: 'Create CMS folder (organization scoped)' })
  createFolder(
    @Body() dto: CreateCmsFolderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.folders.create(dto, toActor(user));
  }

  @Patch('folders/:id')
  @Permissions(Permission.CMS_WRITE, Permission.CMS_MANAGE)
  @ApiOperation({ summary: 'Update CMS folder' })
  updateFolder(
    @Param('id') id: string,
    @Body() dto: UpdateCmsFolderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.folders.update(id, dto, toActor(user));
  }

  @Delete('folders/:id')
  @Permissions(Permission.CMS_MANAGE)
  @ApiOperation({ summary: 'Delete empty CMS folder' })
  deleteFolder(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.folders.remove(id, toActor(user));
  }

  // ——— Articles ———

  @Get('articles')
  @Permissions(Permission.CMS_READ)
  @ApiOperation({
    summary: 'List CMS articles (paginated) — scoped by organization',
  })
  listArticles(
    @Query() query: ListCmsArticlesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.articles.list(query, toActor(user));
  }

  @Get('articles/:id')
  @Permissions(Permission.CMS_READ)
  @ApiOperation({ summary: 'CMS article detail + translations + attachments' })
  getArticle(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.articles.findById(id, toActor(user));
  }

  @Post('articles')
  @Permissions(Permission.CMS_WRITE, Permission.CMS_MANAGE)
  @ApiOperation({ summary: 'Create CMS article + initial translation' })
  createArticle(
    @Body() dto: CreateCmsArticleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.articles.create(dto, user.userId, toActor(user));
  }

  @Patch('articles/:id')
  @Permissions(Permission.CMS_WRITE, Permission.CMS_MANAGE)
  @ApiOperation({ summary: 'Update CMS article metadata' })
  updateArticle(
    @Param('id') id: string,
    @Body() dto: UpdateCmsArticleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.articles.update(id, dto, user.userId, toActor(user));
  }

  @Post('articles/:id/publish')
  @Permissions(Permission.CMS_PUBLISH, Permission.CMS_MANAGE)
  @ApiOperation({ summary: 'Publish CMS article' })
  publishArticle(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.articles.publish(id, user.userId, toActor(user));
  }

  @Post('articles/:id/archive')
  @Permissions(Permission.CMS_WRITE, Permission.CMS_MANAGE)
  @ApiOperation({ summary: 'Archive CMS article' })
  archiveArticle(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.articles.archive(id, user.userId, toActor(user));
  }

  @Delete('articles/:id')
  @Permissions(Permission.CMS_MANAGE)
  @ApiOperation({ summary: 'Delete CMS article' })
  deleteArticle(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.articles.remove(id, toActor(user));
  }

  // ——— Translations ———

  @Put('articles/:id/translations/:locale')
  @Permissions(Permission.CMS_WRITE, Permission.CMS_MANAGE)
  @ApiOperation({ summary: 'Upsert article translation for locale' })
  upsertTranslation(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() dto: UpsertCmsTranslationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.articles.upsertTranslation(
      id,
      locale,
      dto,
      user.userId,
      toActor(user),
    );
  }

  @Delete('articles/:id/translations/:locale')
  @Permissions(Permission.CMS_WRITE, Permission.CMS_MANAGE)
  @ApiOperation({ summary: 'Delete article translation' })
  deleteTranslation(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.articles.removeTranslation(id, locale, toActor(user));
  }

  // ——— Versions ———

  @Get('articles/:id/versions')
  @Permissions(Permission.CMS_READ)
  @ApiOperation({ summary: 'List article versions' })
  listVersions(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.articles.listVersions(id, toActor(user));
  }

  @Get('articles/:id/versions/:version')
  @Permissions(Permission.CMS_READ)
  @ApiOperation({ summary: 'Get article version snapshot' })
  getVersion(
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.articles.getVersion(id, version, toActor(user));
  }

  @Post('articles/:id/versions/:version/rollback')
  @Permissions(Permission.CMS_MANAGE)
  @ApiOperation({ summary: 'Rollback article to a previous version' })
  rollback(
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
    @Body() dto: RollbackCmsVersionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.articles.rollback(id, version, dto, user.userId, toActor(user));
  }

  // ——— Attachments (via Storage FileAsset) ———

  @Post('articles/:id/attachments')
  @Permissions(Permission.CMS_WRITE, Permission.CMS_MANAGE)
  @ApiOperation({
    summary:
      'Attach an existing FileAsset to the article (ownerType=CmsArticle)',
  })
  attachFile(
    @Param('id') id: string,
    @Body() dto: AttachCmsFileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.articles.attachFile(id, dto, user.userId, toActor(user));
  }

  @Delete('articles/:id/attachments/:fileId')
  @Permissions(Permission.CMS_WRITE, Permission.CMS_MANAGE)
  @ApiOperation({ summary: 'Detach and delete article attachment' })
  detachFile(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.articles.detachFile(id, fileId, toActor(user));
  }
}
