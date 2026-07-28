import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingInterval } from '@prisma/client';

/** Checkout abonnement starter (sans organisation). */
export class CreateCheckoutDto {
  @ApiProperty({ enum: ['starter', 'pro'] })
  @IsEnum(['starter', 'pro'] as const)
  planId!: 'starter' | 'pro';

  @ApiProperty({ enum: BillingInterval })
  @IsEnum(BillingInterval)
  interval!: BillingInterval;

  @ApiPropertyOptional({
    description: 'URL de retour en cas d’annulation',
  })
  @IsOptional()
  @IsString()
  cancelUrl?: string;
}

/** Checkout direct (catalogue article / abonnement) — sans organisation. */
export class CreateItemCheckoutDto {
  @ApiProperty({
    description: 'ID du catalogue PAYABLE_ITEMS',
    example: 'sub-starter-monthly',
  })
  @IsString()
  @MinLength(1)
  itemId!: string;

  @ApiPropertyOptional({
    description: 'URL de retour en cas d’annulation',
  })
  @IsOptional()
  @IsString()
  cancelUrl?: string;
}

export class SyncCheckoutDto {
  @ApiProperty({ example: 'cs_test_...' })
  @IsString()
  @MinLength(1)
  sessionId!: string;
}
