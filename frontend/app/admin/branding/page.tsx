'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Permission, type BrandConfig } from '@saas-starter/shared';
import { BrandLogo } from '@/components/brand-logo';
import { Button, Input } from '@/components/ui';
import { layout } from '@/lib/components';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useBrand, useToast } from '@/providers';
import {
  getBrandPreview,
  updateBrandConfig,
  uploadBrandLogo,
} from '@/services/brand.service';

type FormState = {
  appName: string;
  companyName: string;
  appUrl: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  theme: 'light' | 'dark';
  fontFamily: string;
  supportEmail: string;
  supportUrl: string;
  metaDescription: string;
};

function toForm(brand: BrandConfig): FormState {
  return {
    appName: brand.appName,
    companyName: brand.companyName,
    appUrl: brand.appUrl,
    logoUrl: brand.logoUrl,
    faviconUrl: brand.faviconUrl,
    primaryColor: brand.primaryColor,
    secondaryColor: brand.secondaryColor,
    theme: brand.theme === 'dark' ? 'dark' : 'light',
    fontFamily: brand.fontFamily,
    supportEmail: brand.supportEmail,
    supportUrl: brand.supportUrl,
    metaDescription: brand.metaDescription,
  };
}

export default function BrandingPage() {
  const { accessToken } = useAuth();
  const { brand: liveBrand, refreshBrand, applyBrand } = useBrand();
  const toast = useToast();
  const { can } = usePermissions();
  const canRead = can(Permission.BRAND_READ) || can(Permission.ADMIN_ACCESS);
  const canWrite = can(Permission.BRAND_WRITE);

  const [form, setForm] = useState<FormState>(() => toForm(liveBrand));
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !canRead) return;
    setLoading(true);
    try {
      const preview = await getBrandPreview(accessToken);
      setForm(toForm(preview.brand));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur branding');
    } finally {
      setLoading(false);
    }
  }, [accessToken, canRead, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Aperçu live (conserve le thème light/dark choisi dans le switcher).
  useEffect(() => {
    if (loading) return;
    const { theme: _theme, ...rest } = form;
    applyBrand({
      ...rest,
      logoUrl: logoPreview || form.logoUrl,
    });
  }, [form, logoPreview, loading, applyBrand]);

  const draftBrand = useMemo<BrandConfig>(
    () => ({
      ...liveBrand,
      ...form,
      logoUrl: logoPreview || form.logoUrl,
    }),
    [liveBrand, form, logoPreview],
  );

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken || !canWrite) return;
    setBusy(true);
    try {
      const saved = await updateBrandConfig(accessToken, form);
      setForm(toForm(saved));
      setLogoPreview(null);
      applyBrand({
        ...saved,
      });
      await refreshBrand();
      toast.success('Branding enregistré.');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Enregistrement impossible',
      );
    } finally {
      setBusy(false);
    }
  };

  const onLogoChange = async (file: File | null) => {
    if (!file || !accessToken || !canWrite) return;
    setBusy(true);
    const localUrl = URL.createObjectURL(file);
    setLogoPreview(localUrl);
    try {
      const saved = await uploadBrandLogo(accessToken, file);
      setForm(toForm(saved));
      setLogoPreview(null);
      applyBrand({ ...saved });
      await refreshBrand();
      toast.success('Logo mis à jour.');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Upload logo impossible',
      );
    } finally {
      URL.revokeObjectURL(localUrl);
      setBusy(false);
    }
  };

  if (!canRead) {
    return (
      <main className="admin" style={layout.admin}>
        <p className="error">Accès branding réservé aux administrateurs.</p>
      </main>
    );
  }

  return (
    <main className="admin branding-page" style={layout.admin}>
      <header className="admin-header">
        <div>
          <h1>Branding</h1>
          <p>
            Modifiez le logo, le nom et les couleurs white-label — aperçu en
            direct.
          </p>
        </div>
      </header>

      <div className="branding-layout">
        <section className="status brand-preview-card">
          <p className="hint">Aperçu</p>
          {logoPreview || draftBrand.logoUrl ? (
            <img
              src={logoPreview || draftBrand.logoUrl}
              alt={draftBrand.appName}
              className="brand-preview-logo"
              height={56}
            />
          ) : (
            <BrandLogo height={56} />
          )}
          <h2 style={{ color: draftBrand.primaryColor }}>
            {draftBrand.appName}
          </h2>
          <p>{draftBrand.companyName}</p>
          <p className="hint">{draftBrand.metaDescription}</p>
          <div className="brand-swatches">
            <span
              style={{ background: draftBrand.primaryColor }}
              title="primary"
            />
            <span
              style={{ background: draftBrand.secondaryColor }}
              title="secondary"
            />
          </div>
          <p>
            Thème <code>{draftBrand.theme}</code> · Police{' '}
            <code>{draftBrand.fontFamily}</code>
          </p>
          <p>
            Support :{' '}
            <a href={draftBrand.supportUrl}>{draftBrand.supportEmail}</a>
          </p>
        </section>

        {loading ? (
          <p className="hint">Chargement…</p>
        ) : (
          <form
            className="admin-form branding-form"
            onSubmit={(e) => void onSubmit(e)}
          >
            <h2>Paramètres</h2>

            <label>
              Logo
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                disabled={!canWrite || busy}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  void onLogoChange(file);
                  e.target.value = '';
                }}
              />
              <span className="hint">
                PNG, JPEG, WebP, SVG ou GIF · max 2 Mo. URL actuelle :{' '}
                <code>{form.logoUrl}</code>
              </span>
            </label>

            <label>
              Nom de l’application
              <Input
                value={form.appName}
                disabled={!canWrite || busy}
                onChange={(e) => setField('appName', e.target.value)}
                required
              />
            </label>

            <label>
              Société
              <Input
                value={form.companyName}
                disabled={!canWrite || busy}
                onChange={(e) => setField('companyName', e.target.value)}
              />
            </label>

            <label>
              URL de l’app
              <Input
                value={form.appUrl}
                disabled={!canWrite || busy}
                onChange={(e) => setField('appUrl', e.target.value)}
              />
            </label>

            <div className="branding-colors">
              <label>
                Couleur primaire
                <span className="branding-color-row">
                  <input
                    type="color"
                    value={form.primaryColor}
                    disabled={!canWrite || busy}
                    onChange={(e) => setField('primaryColor', e.target.value)}
                    aria-label="Couleur primaire"
                  />
                  <Input
                    value={form.primaryColor}
                    disabled={!canWrite || busy}
                    onChange={(e) => setField('primaryColor', e.target.value)}
                    pattern="^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"
                  />
                </span>
              </label>
              <label>
                Couleur secondaire
                <span className="branding-color-row">
                  <input
                    type="color"
                    value={form.secondaryColor}
                    disabled={!canWrite || busy}
                    onChange={(e) => setField('secondaryColor', e.target.value)}
                    aria-label="Couleur secondaire"
                  />
                  <Input
                    value={form.secondaryColor}
                    disabled={!canWrite || busy}
                    onChange={(e) => setField('secondaryColor', e.target.value)}
                    pattern="^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"
                  />
                </span>
              </label>
            </div>

            <label>
              Thème par défaut
              <select
                value={form.theme}
                disabled={!canWrite || busy}
                onChange={(e) =>
                  setField('theme', e.target.value as 'light' | 'dark')
                }
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>

            <label>
              Police
              <Input
                value={form.fontFamily}
                disabled={!canWrite || busy}
                onChange={(e) => setField('fontFamily', e.target.value)}
              />
            </label>

            <label>
              Favicon URL
              <Input
                value={form.faviconUrl}
                disabled={!canWrite || busy}
                onChange={(e) => setField('faviconUrl', e.target.value)}
              />
            </label>

            <label>
              Email support
              <Input
                type="email"
                value={form.supportEmail}
                disabled={!canWrite || busy}
                onChange={(e) => setField('supportEmail', e.target.value)}
              />
            </label>

            <label>
              URL support
              <Input
                value={form.supportUrl}
                disabled={!canWrite || busy}
                onChange={(e) => setField('supportUrl', e.target.value)}
              />
            </label>

            <label>
              Meta description
              <Input
                value={form.metaDescription}
                disabled={!canWrite || busy}
                onChange={(e) => setField('metaDescription', e.target.value)}
              />
            </label>

            {canWrite ? (
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? 'Enregistrement…' : 'Enregistrer le branding'}
              </Button>
            ) : (
              <p className="hint">
                Permission `brand:write` requise pour modifier.
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
