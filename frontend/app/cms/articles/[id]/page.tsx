'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { CmsArticleStatus, FileUploadKind } from '@saas-starter/shared';
import { FileUpload } from '@/components/file-upload';
import { RichTextEditor } from '@/components/cms/rich-text-editor';
import { Button, Input } from '@/components/ui';
import { layout } from '@/lib/components';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/providers';
import {
  getAiStatus,
  rewriteText,
  translateArticle,
  type AiRewriteMode,
  type AiStatus,
} from '@/services/ai.service';
import {
  attachFile,
  getArticle,
  publishArticle,
  updateArticle,
  upsertTranslation,
  type CmsArticle,
} from '@/services/cms.service';

const REWRITE_MODES: Array<{ value: AiRewriteMode; label: string }> = [
  { value: 'ameliorer', label: 'Améliorer' },
  { value: 'professionnel', label: 'Professionnel' },
  { value: 'court', label: 'Court' },
  { value: 'long', label: 'Long' },
  { value: 'seo', label: 'SEO' },
  { value: 'corriger', label: 'Corriger' },
];

const SUGGESTED_TARGET_LOCALES = ['en', 'mg', 'es', 'de'];

export default function CmsArticleEditorPage() {
  const params = useParams<{ id: string }>();
  const articleId = params.id;
  const { accessToken } = useAuth();
  const { canCmsRead, canCmsWrite, canCmsPublish } = usePermissions();
  const toast = useToast();

  const [article, setArticle] = useState<CmsArticle | null>(null);
  const [locale, setLocale] = useState('fr');
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<string>(CmsArticleStatus.DRAFT);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [targetLocale, setTargetLocale] = useState('en');
  const [translating, setTranslating] = useState(false);
  const [translateMsg, setTranslateMsg] = useState<string | null>(null);
  const [translatePreview, setTranslatePreview] = useState<{
    targetLocale: string;
    title: string;
    excerpt: string | null;
    content: string;
  } | null>(null);
  const [acceptingTranslate, setAcceptingTranslate] = useState(false);

  const [rewriteMode, setRewriteMode] = useState<AiRewriteMode>('ameliorer');
  const [rewriting, setRewriting] = useState(false);
  const [rewritePreview, setRewritePreview] = useState<string | null>(null);
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !canCmsRead || !articleId) return;
    setLoadError(null);
    try {
      const [data, statusRes] = await Promise.all([
        getArticle(accessToken, articleId),
        getAiStatus(accessToken).catch(() => null),
      ]);
      setArticle(data);
      setSlug(data.slug);
      setStatus(data.status);
      if (statusRes) setAiStatus(statusRes);
      setLocale((current) => {
        const preferred =
          data.translations.find((t) => t.locale === current) ??
          data.translations[0];
        if (preferred) {
          setTitle(preferred.title);
          setExcerpt(preferred.excerpt ?? '');
          setContent(preferred.content);
          return preferred.locale;
        }
        return current;
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Erreur chargement article';
      setLoadError(msg);
      toast.error(msg);
    }
  }, [accessToken, canCmsRead, articleId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const locales = useMemo(
    () => article?.translations.map((t) => t.locale) ?? [],
    [article],
  );

  const switchLocale = (next: string) => {
    if (!article) return;
    const existing = article.translations.find((t) => t.locale === next);
    setLocale(next);
    if (existing) {
      setTitle(existing.title);
      setExcerpt(existing.excerpt ?? '');
      setContent(existing.content);
    } else {
      setTitle('');
      setExcerpt('');
      setContent('');
    }
  };

  const onSaveTranslation = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken || !canCmsWrite) return;
    setSaving(true);
    try {
      await updateArticle(accessToken, articleId, { slug, status });
      const updated = await upsertTranslation(accessToken, articleId, locale, {
        title,
        excerpt: excerpt || null,
        content,
      });
      setArticle(updated);
      toast.success(`Traduction « ${locale} » enregistrée.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Enregistrement impossible',
      );
    } finally {
      setSaving(false);
    }
  };

  const onPublish = async () => {
    if (!accessToken || !canCmsPublish) return;
    try {
      const updated = await publishArticle(accessToken, articleId);
      setArticle(updated);
      setStatus(updated.status);
      toast.success('Article publié.');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Publication impossible',
      );
    }
  };

  const onTranslateAi = async () => {
    if (!accessToken || !canCmsWrite) return;
    const target = targetLocale.trim().toLowerCase();
    if (!target || target === locale) {
      toast.error('Choisissez une locale cible différente de la source.');
      return;
    }
    setTranslating(true);
    setTranslateMsg(null);
    setTranslatePreview(null);
    try {
      const result = await translateArticle(accessToken, {
        articleId,
        sourceLocale: locale,
        targetLocale: target,
      });
      setTranslatePreview({
        targetLocale: result.targetLocale,
        title: result.translation.title,
        excerpt: result.translation.excerpt,
        content: result.translation.content,
      });
      setTranslateMsg(
        `Aperçu ${result.sourceLocale} → ${result.targetLocale} — accepter pour enregistrer.`,
      );
      toast.success('Traduction générée (aperçu).');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Traduction IA impossible';
      setTranslateMsg(msg);
      toast.error(msg);
    } finally {
      setTranslating(false);
    }
  };

  const acceptTranslate = async () => {
    if (!accessToken || !canCmsWrite || !translatePreview) return;
    setAcceptingTranslate(true);
    try {
      const updated = await upsertTranslation(
        accessToken,
        articleId,
        translatePreview.targetLocale,
        {
          title: translatePreview.title,
          excerpt: translatePreview.excerpt,
          content: translatePreview.content,
        },
      );
      setArticle(updated);
      setLocale(translatePreview.targetLocale);
      setTitle(translatePreview.title);
      setExcerpt(translatePreview.excerpt ?? '');
      setContent(translatePreview.content);
      setTranslatePreview(null);
      setTranslateMsg(null);
      toast.success(
        `Traduction « ${translatePreview.targetLocale} » enregistrée.`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Enregistrement impossible',
      );
    } finally {
      setAcceptingTranslate(false);
    }
  };

  const rejectTranslate = () => {
    setTranslatePreview(null);
    setTranslateMsg(null);
  };

  const onRewriteAi = async () => {
    if (!accessToken || !canCmsWrite) return;
    if (!content.trim()) {
      toast.error('Le contenu est vide.');
      return;
    }
    setRewriting(true);
    setRewriteError(null);
    setRewritePreview(null);
    try {
      const result = await rewriteText(accessToken, {
        text: content,
        mode: rewriteMode,
      });
      setRewritePreview(result.text);
      toast.success('Réécriture générée.');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Réécriture IA impossible';
      setRewriteError(msg);
      toast.error(msg);
    } finally {
      setRewriting(false);
    }
  };

  const acceptRewrite = () => {
    if (rewritePreview == null) return;
    setContent(rewritePreview);
    setRewritePreview(null);
    toast.success('Réécriture acceptée — enregistrez pour persister.');
  };

  const rejectRewrite = () => {
    setRewritePreview(null);
    setRewriteError(null);
  };

  if (!canCmsRead) {
    return (
      <main className="admin" style={layout.cms}>
        <p className="error">Accès CMS refusé.</p>
      </main>
    );
  }

  if (!article) {
    return (
      <main className="admin" style={layout.cms}>
        {loadError ? <p className="error">{loadError}</p> : <p>Chargement…</p>}
        <Link href="/cms">Retour CMS</Link>
      </main>
    );
  }

  return (
    <main className="admin cms-page cms-page--editor" style={layout.cms}>
      <header className="admin-header cms-editor-header">
        <div>
          <h1>Éditeur CMS</h1>
          <p>
            <code>{article.slug}</code> · dossier{' '}
            <code>{article.folder?.code}</code>
          </p>
        </div>
        <nav className="links">
          <Link href="/cms">Explorateur</Link>
        </nav>
      </header>

      <div className="cms-layout cms-layout--editor">
        <section className="cms-main">
          <form
            className="admin-form status cms-editor-form"
            onSubmit={onSaveTranslation}
          >
            <div className="admin-filters">
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                aria-label="Slug"
                disabled={!canCmsWrite}
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={!canCmsWrite}
                aria-label="Statut"
              >
                {Object.values(CmsArticleStatus).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {canCmsPublish ? (
                <Button variant="primary" onClick={onPublish}>
                  Publier
                </Button>
              ) : null}
              {canCmsWrite ? (
                <Button type="submit" disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              ) : null}
            </div>

            <div className="admin-filters">
              <label className="hint">Traduction</label>
              {locales.map((l) => (
                <Button
                  key={l}
                  variant={locale === l ? 'primary' : 'social'}
                  onClick={() => switchLocale(l)}
                >
                  {l}
                </Button>
              ))}
              <Input
                placeholder="nouvelle locale"
                value={locale}
                onChange={(e) => setLocale(e.target.value.toLowerCase())}
                aria-label="Locale"
                style={{ maxWidth: '8rem' }}
              />
            </div>

            <div className="cms-editor-meta">
              <Input
                placeholder="Titre"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                disabled={!canCmsWrite}
              />
              <Input
                placeholder="Extrait"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                disabled={!canCmsWrite}
              />
            </div>

            <RichTextEditor
              className="cms-editor-content"
              placeholder="Contenu"
              value={content}
              onChange={setContent}
              disabled={!canCmsWrite}
            />
          </form>
        </section>

        <aside className="cms-sidebar">
          {canCmsWrite ? (
            <section className="status cms-ai-panel">
              <h2>✨ IA</h2>

              <div className="admin-filters">
                <label className="hint">Traduire {locale} →</label>
                <Input
                  value={targetLocale}
                  onChange={(e) =>
                    setTargetLocale(e.target.value.toLowerCase())
                  }
                  aria-label="Locale cible"
                  style={{ maxWidth: '5rem' }}
                  list="ai-target-locales"
                />
                <datalist id="ai-target-locales">
                  {SUGGESTED_TARGET_LOCALES.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </div>
              <div className="admin-filters">
                {SUGGESTED_TARGET_LOCALES.filter((l) => l !== locale).map(
                  (l) => (
                    <Button
                      key={l}
                      variant="social"
                      type="button"
                      onClick={() => setTargetLocale(l)}
                    >
                      {l}
                    </Button>
                  ),
                )}
                <Button
                  type="button"
                  variant="primary"
                  disabled={translating || !aiStatus?.active}
                  onClick={() => void onTranslateAi()}
                >
                  {translating ? 'Traduction…' : '✨ Traduire'}
                </Button>
              </div>
              {translateMsg ? (
                <p
                  className={
                    translateMsg.startsWith('Aperçu') ? 'hint' : 'error'
                  }
                >
                  {translateMsg}
                </p>
              ) : null}
              {translatePreview ? (
                <div className="cms-ai-preview">
                  <p className="hint">
                    Aperçu « {translatePreview.targetLocale} » :
                  </p>
                  <Input value={translatePreview.title} readOnly />
                  <textarea
                    readOnly
                    value={translatePreview.content}
                    aria-label="Aperçu traduction IA"
                  />
                  <div className="admin-filters">
                    <Button
                      type="button"
                      variant="primary"
                      disabled={acceptingTranslate}
                      onClick={() => void acceptTranslate()}
                    >
                      {acceptingTranslate ? '…' : 'Accepter'}
                    </Button>
                    <Button
                      type="button"
                      variant="social"
                      onClick={rejectTranslate}
                    >
                      Refuser
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="admin-filters">
                <label className="hint">Réécrire</label>
                <select
                  value={rewriteMode}
                  onChange={(e) =>
                    setRewriteMode(e.target.value as AiRewriteMode)
                  }
                  aria-label="Mode réécriture"
                >
                  {REWRITE_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="primary"
                  disabled={rewriting || !aiStatus?.active}
                  onClick={() => void onRewriteAi()}
                >
                  {rewriting ? '…' : '✨ Réécrire'}
                </Button>
              </div>
              {rewriteError ? <p className="error">{rewriteError}</p> : null}
              {rewritePreview != null ? (
                <div className="cms-ai-preview">
                  <p className="hint">Proposition :</p>
                  <textarea
                    readOnly
                    value={rewritePreview}
                    aria-label="Aperçu réécriture IA"
                  />
                  <div className="admin-filters">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={acceptRewrite}
                    >
                      Accepter
                    </Button>
                    <Button
                      type="button"
                      variant="social"
                      onClick={rejectRewrite}
                    >
                      Refuser
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="status">
            <h2>Pièces jointes</h2>
            <ul>
              {(article.attachments ?? []).map((f) => (
                <li key={f.id}>
                  <a href={f.url} target="_blank" rel="noreferrer">
                    {f.originalName}
                  </a>
                </li>
              ))}
            </ul>
            {canCmsWrite && accessToken ? (
              <FileUpload
                accessToken={accessToken}
                kind={FileUploadKind.DOCUMENT}
                ownerType="CmsArticle"
                ownerId={articleId}
                onUploaded={async (file) => {
                  await attachFile(accessToken, articleId, file.id);
                  await load();
                }}
              />
            ) : null}
          </section>
        </aside>
      </div>
    </main>
  );
}
