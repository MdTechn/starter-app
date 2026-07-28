import { BadRequestException, Injectable } from '@nestjs/common';
import { FILE_UPLOAD_RULES, FileUploadKind } from '@saas-starter/shared';

@Injectable()
export class FileValidationService {
  assertValid(
    kind: FileUploadKind | string,
    mimeType: string,
    size: number,
  ): FileUploadKind {
    const normalized = this.toKind(kind);
    const rules = FILE_UPLOAD_RULES[normalized];
    if (!rules) {
      throw new BadRequestException({
        code: 'INVALID_FILE_KIND',
        message: `Unknown file kind: ${kind}`,
      });
    }

    if (!rules.mimeTypes.includes(mimeType)) {
      throw new BadRequestException({
        code: 'INVALID_MIME_TYPE',
        message: `MIME type ${mimeType} not allowed for ${normalized}`,
        allowed: rules.mimeTypes,
      });
    }

    if (size <= 0 || size > rules.maxBytes) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `File exceeds max size of ${rules.maxBytes} bytes for ${normalized}`,
        maxBytes: rules.maxBytes,
      });
    }

    return normalized;
  }

  private toKind(kind: string): FileUploadKind {
    const upper = kind.toUpperCase();
    if (Object.values(FileUploadKind).includes(upper as FileUploadKind)) {
      return upper as FileUploadKind;
    }
    throw new BadRequestException({
      code: 'INVALID_FILE_KIND',
      message: `Unknown file kind: ${kind}`,
    });
  }
}
