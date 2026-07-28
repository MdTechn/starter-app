import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { hasPermission, Permission, UserRole } from '@saas-starter/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { StorageService } from './storage.service';
import { UploadMetaDto } from './dto/storage.dto';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@ApiTags('storage')
@ApiBearerAuth()
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Get('driver')
  @Permissions(Permission.UPLOAD_READ)
  @ApiOperation({ summary: 'Active storage driver (from config)' })
  driver() {
    return { driver: this.storage.getDriverName() };
  }

  @Get('files')
  @Permissions(Permission.UPLOAD_READ)
  @ApiOperation({ summary: 'List files uploaded by current user' })
  list(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    const userId = this.requireUserId(user);
    const parsed = limit ? Number(limit) : 50;
    return this.storage.listForUser(
      userId,
      Number.isFinite(parsed) ? parsed : 50,
    );
  }

  @Post('upload')
  @Permissions(Permission.UPLOAD_WRITE)
  @ApiOperation({ summary: 'Upload image, document, or avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'kind'],
      properties: {
        file: { type: 'string', format: 'binary' },
        kind: {
          type: 'string',
          enum: ['IMAGE', 'DOCUMENT', 'AVATAR'],
        },
        ownerType: { type: 'string' },
        ownerId: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadMetaDto,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Multipart field "file" is required',
      });
    }

    return this.storage.upload({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      kind: body.kind,
      ownerType: body.ownerType,
      ownerId: body.ownerId,
      uploadedById: this.requireUserId(user),
    });
  }

  @Delete(':id')
  @Permissions(Permission.UPLOAD_DELETE)
  @ApiOperation({ summary: 'Delete a file (owner or upload:manage)' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const userId = this.requireUserId(user);
    const canManage = hasPermission(
      user.roles as UserRole[],
      Permission.UPLOAD_MANAGE,
    );
    return this.storage.delete(id, { userId, canManage });
  }

  @Get('content/:id')
  @Public()
  @ApiOperation({ summary: 'Public content URL (local driver streaming)' })
  async serveContent(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const asset = await this.storage.getById(id);
    const stream = await this.storage.openReadStream(asset.key);
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(asset.originalName)}"`,
    );
    return new StreamableFile(stream);
  }

  private requireUserId(user: AuthenticatedUser): string {
    if (!user.userId) {
      throw new ForbiddenException('User not synced');
    }
    return user.userId;
  }
}
