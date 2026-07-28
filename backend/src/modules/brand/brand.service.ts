import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_BRAND_CONFIG,
  resolveBrandConfig,
  type BrandConfig,
  type BrandTheme,
} from '@saas-starter/shared';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { UpdateBrandDto } from './dto/brand.dto';

const LOGO_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/gif': '.gif',
};

@Injectable()
export class BrandService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(BrandService.name);
  }

  private baseFromEnv(): BrandConfig {
    return (
      this.config.get<BrandConfig>('brand') ??
      resolveBrandConfig(process.env as Record<string, string | undefined>)
    );
  }

  async getConfig(): Promise<BrandConfig> {
    const base = this.baseFromEnv();
    const row = await this.prisma.brandSettings.findUnique({
      where: { id: 'default' },
    });
    if (!row) return base;

    return {
      ...base,
      appName: row.appName ?? base.appName,
      companyName: row.companyName ?? base.companyName,
      appUrl: row.appUrl ?? base.appUrl,
      logoUrl: row.logoUrl ?? base.logoUrl,
      faviconUrl: row.faviconUrl ?? base.faviconUrl,
      primaryColor: row.primaryColor ?? base.primaryColor,
      secondaryColor: row.secondaryColor ?? base.secondaryColor,
      theme: (row.theme as BrandTheme | null) ?? base.theme,
      fontFamily: row.fontFamily ?? base.fontFamily,
      iconUrl: row.iconUrl ?? base.iconUrl,
      appleTouchIconUrl: row.appleTouchIconUrl ?? base.appleTouchIconUrl,
      supportEmail: row.supportEmail ?? base.supportEmail,
      supportUrl: row.supportUrl ?? base.supportUrl,
      metaDescription: row.metaDescription ?? base.metaDescription,
    };
  }

  /** Absolute path to monorepo branding/ assets folder. */
  getAssetsRoot(): string {
    const candidates = [
      join(process.cwd(), 'branding'),
      join(process.cwd(), '..', 'branding'),
      join(__dirname, '../../../../../branding'),
    ];
    for (const dir of candidates) {
      if (existsSync(dir)) return dir;
    }
    return candidates[0];
  }

  private getPublicBrandingRoots(): string[] {
    const assets = this.getAssetsRoot();
    const roots = [assets];
    const publicMirror = join(assets, '..', 'frontend', 'public', 'branding');
    if (publicMirror !== assets) {
      roots.push(publicMirror);
    }
    const cwdPublic = join(process.cwd(), 'frontend', 'public', 'branding');
    if (!roots.includes(cwdPublic)) roots.push(cwdPublic);
    const siblingPublic = join(
      process.cwd(),
      '..',
      'frontend',
      'public',
      'branding',
    );
    if (!roots.includes(siblingPublic)) roots.push(siblingPublic);
    return roots;
  }

  async getPreviewPayload() {
    const brand = await this.getConfig();
    return {
      brand,
      defaults: DEFAULT_BRAND_CONFIG,
      assetsRoot: this.getAssetsRoot(),
      assetsAvailable: existsSync(this.getAssetsRoot()),
      cssVariables: {
        '--accent': brand.primaryColor,
        '--brand-secondary': brand.secondaryColor,
        '--font': brand.fontFamily,
        '--brand-theme': brand.theme,
      },
    };
  }

  async update(dto: UpdateBrandDto): Promise<BrandConfig> {
    const data = {
      appName: dto.appName,
      companyName: dto.companyName,
      appUrl: dto.appUrl,
      logoUrl: dto.logoUrl,
      faviconUrl: dto.faviconUrl,
      primaryColor: dto.primaryColor,
      secondaryColor: dto.secondaryColor,
      theme: dto.theme,
      fontFamily: dto.fontFamily,
      supportEmail: dto.supportEmail,
      supportUrl: dto.supportUrl,
      metaDescription: dto.metaDescription,
    };

    await this.prisma.brandSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data },
      update: data,
    });

    this.logger.log(
      `Brand settings updated appName=${dto.appName ?? '(unchanged)'}`,
    );
    return this.getConfig();
  }

  async uploadLogo(file: {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
    size: number;
  }): Promise<BrandConfig> {
    const ext =
      LOGO_MIME[file.mimetype] ??
      (extname(file.originalname).toLowerCase() || null);
    if (!ext || !Object.values(LOGO_MIME).includes(ext)) {
      throw new BadRequestException({
        code: 'BRAND_LOGO_INVALID',
        message: 'Logo must be PNG, JPEG, WebP, GIF or SVG',
      });
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException({
        code: 'BRAND_LOGO_TOO_LARGE',
        message: 'Logo must be ≤ 2 MB',
      });
    }

    const filename = `logo${ext}`;
    const roots = this.getPublicBrandingRoots();
    let written = false;
    for (const root of roots) {
      try {
        mkdirSync(root, { recursive: true });
        writeFileSync(join(root, filename), file.buffer);
        written = true;
      } catch (err) {
        this.logger.warn(
          `Could not write logo to ${root}: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }
    if (!written) {
      throw new BadRequestException({
        code: 'BRAND_LOGO_WRITE_FAILED',
        message: 'Unable to write logo to branding directory',
      });
    }

    const logoUrl = `/branding/${filename}?v=${Date.now()}`;
    return this.update({ logoUrl });
  }
}
