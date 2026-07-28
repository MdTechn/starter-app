import { IsEnum, IsOptional, IsString } from 'class-validator';
import { FileUploadKind } from '@saas-starter/shared';

export class UploadMetaDto {
  @IsEnum(FileUploadKind)
  kind!: FileUploadKind;

  @IsOptional()
  @IsString()
  ownerType?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;
}
