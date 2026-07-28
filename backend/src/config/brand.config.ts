import { registerAs } from '@nestjs/config';
import { resolveBrandConfig, type BrandConfig } from '@saas-starter/shared';

export const brandConfigFactory = (): BrandConfig =>
  resolveBrandConfig(process.env as Record<string, string | undefined>);

export default registerAs('brand', brandConfigFactory);
