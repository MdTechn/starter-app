import { IsArray, IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { NotificationEventType } from '@prisma/client';

export class UpdatePreferenceDto {
  @IsEnum(NotificationEventType)
  eventType!: NotificationEventType;

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;
}

export class UpdatePreferencesBulkDto {
  @IsArray()
  preferences!: UpdatePreferenceDto[];
}
