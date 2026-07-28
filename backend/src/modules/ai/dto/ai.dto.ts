import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum AiRewriteMode {
  AMELIORER = 'ameliorer',
  PROFESSIONNEL = 'professionnel',
  COURT = 'court',
  LONG = 'long',
  SEO = 'seo',
  CORRIGER = 'corriger',
}

export class TranslateDto {
  @IsString()
  @MinLength(1)
  articleId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(12)
  @Matches(/^[a-zA-Z]{2}(?:-[a-zA-Z]{2})?$/, {
    message: 'sourceLocale must look like fr or en-US',
  })
  sourceLocale!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(12)
  @Matches(/^[a-zA-Z]{2}(?:-[a-zA-Z]{2})?$/, {
    message: 'targetLocale must look like en or mg',
  })
  targetLocale!: string;
}

export class RewriteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50_000)
  text!: string;

  @IsEnum(AiRewriteMode)
  mode!: AiRewriteMode;
}

export class AiUsageQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  userId?: string;
}
