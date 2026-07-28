import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
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
import { Permission } from '@saas-starter/shared';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { BrandService } from './brand.service';
import { UpdateBrandDto } from './dto/brand.dto';

@ApiTags('brand')
@Controller('brand')
export class BrandController {
  constructor(private readonly brand: BrandService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Public brand configuration (white-label)' })
  getBrand() {
    return this.brand.getConfig();
  }

  @Get('preview')
  @ApiBearerAuth()
  @Permissions(Permission.BRAND_READ)
  @ApiOperation({ summary: 'Admin branding preview payload' })
  preview() {
    return this.brand.getPreviewPayload();
  }

  @Patch()
  @ApiBearerAuth()
  @Permissions(Permission.BRAND_WRITE)
  @ApiOperation({ summary: 'Update white-label branding settings' })
  update(@Body() dto: UpdateBrandDto) {
    return this.brand.update(dto);
  }

  @Post('logo')
  @ApiBearerAuth()
  @Permissions(Permission.BRAND_WRITE)
  @ApiOperation({ summary: 'Upload brand logo (PNG/JPEG/WebP/SVG/GIF)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadLogo(
    @UploadedFile()
    file?: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: 'BRAND_LOGO_MISSING',
        message: 'file is required',
      });
    }
    return this.brand.uploadLogo(file);
  }
}
