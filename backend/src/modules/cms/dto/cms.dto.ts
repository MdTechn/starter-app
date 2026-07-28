import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CmsArticleStatus } from '@saas-starter/shared';

export class CreateCmsFolderDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'code must be lowercase alphanumeric with hyphens',
  })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  /** Tenant org — resolved from membership when omitted. */
  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class UpdateCmsFolderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateCmsArticleDto {
  @IsString()
  folderId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric with hyphens',
  })
  slug!: string;

  @IsOptional()
  @IsEnum(CmsArticleStatus)
  status?: CmsArticleStatus;

  /** Locale of the initial translation (default: en). */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(12)
  @Matches(/^[a-zA-Z]{2}(?:-[a-zA-Z]{2})?$/, {
    message: 'locale must look like en or en-US',
  })
  locale?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  excerpt?: string;

  @IsString()
  @MinLength(1)
  content!: string;

  /** Tenant org — defaults to folder org / membership when omitted. */
  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class UpdateCmsArticleDto {
  @IsOptional()
  @IsString()
  folderId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric with hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsEnum(CmsArticleStatus)
  status?: CmsArticleStatus;
}

export class UpsertCmsTranslationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  excerpt?: string | null;

  @IsString()
  @MinLength(1)
  content!: string;

  /** Prep SEO — accepted but not processed in Phase 1. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  seoTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string | null;
}

export class ListCmsArticlesQueryDto {
  @IsOptional()
  @IsString()
  folderId?: string;

  @IsOptional()
  @IsEnum(CmsArticleStatus)
  status?: CmsArticleStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class AttachCmsFileDto {
  @IsString()
  @MinLength(1)
  fileId!: string;
}

export class RollbackCmsVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
