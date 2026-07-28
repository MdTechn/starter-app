'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CmsArticleStatus, Permission } from '@saas-starter/shared';
import { Badge, Button, Input } from '@/components/ui';
import { RichTextEditor } from '@/components/cms/rich-text-editor';
import { layout } from '@/lib/components';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useOrganization, useToast } from '@/providers';
import {
  createArticle,
  createFolder,
  listArticles,
  listFolders,
  type CmsArticle,
  type CmsFolder,
} from '@/services/cms.service';

function FolderTree({
  nodes,
  selectedId,
  onSelect,
  depth = 0,
}: {
  nodes: CmsFolder[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  depth?: number;
}) {
  return (
    <ul className="cms-tree" style={{ paddingLeft: depth ? '1rem' : 0 }}>
      {nodes.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            className={
              selectedId === node.id ? 'cms-folder active' : 'cms-folder'
            }
            onClick={() => onSelect(selectedId === node.id ? null : node.id)}
          >
            <span>{node.name}</span>
            <code>{node.code}</code>
            {node._count ? (
              <span className="hint">
                {node._count.articles} art. · {node._count.children} sous-d.
              </span>
            ) : null}
          </button>
          {node.children?.length ? (
            <FolderTree
              nodes={node.children}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default function CmsPage() {
  const { accessToken } = useAuth();
  const { can, canCmsWrite } = usePermissions();
  const toast = useToast();
  const { activeOrganizationId } = useOrganization();
  const canRead = can(Permission.CMS_READ);

  const [folders, setFolders] = useState<CmsFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [articles, setArticles] = useState<CmsArticle[]>([]);
  const [status, setStatus] = useState<string>('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  const [folderForm, setFolderForm] = useState({
    code: '',
    name: '',
    parentId: '',
  });
  const [articleForm, setArticleForm] = useState({
    slug: '',
    title: '',
    content: '',
    locale: 'fr',
  });

  const load = useCallback(async () => {
    if (!accessToken || !canRead) return;
    setLoading(true);
    try {
      const [tree, list] = await Promise.all([
        listFolders(accessToken, true),
        listArticles(accessToken, {
          folderId: selectedFolderId ?? undefined,
          status: status || undefined,
          q: q || undefined,
          page: 1,
          pageSize: 50,
        }),
      ]);
      setFolders(tree);
      setArticles(list.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur CMS');
    } finally {
      setLoading(false);
    }
  }, [accessToken, canRead, selectedFolderId, status, q, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreateFolder = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken || !canCmsWrite) return;
    try {
      await createFolder(accessToken, {
        code: folderForm.code,
        name: folderForm.name,
        parentId: folderForm.parentId || selectedFolderId || undefined,
        organizationId: activeOrganizationId ?? undefined,
      });
      setFolderForm({ code: '', name: '', parentId: '' });
      toast.success('Dossier créé.');
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Création dossier impossible',
      );
    }
  };

  const onCreateArticle = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken || !canCmsWrite || !selectedFolderId) {
      toast.warning('Sélectionnez un dossier pour créer un article.');
      return;
    }
    try {
      const created = await createArticle(accessToken, {
        folderId: selectedFolderId,
        slug: articleForm.slug,
        title: articleForm.title,
        content: articleForm.content,
        locale: articleForm.locale,
        organizationId: activeOrganizationId ?? undefined,
      });
      setArticleForm({ slug: '', title: '', content: '', locale: 'fr' });
      toast.success('Article créé.');
      window.location.href = `/cms/articles/${created.id}`;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Création article impossible',
      );
    }
  };

  if (!canRead) {
    return (
      <main className="admin" style={layout.cms}>
        <p className="error" role="alert">
          Accès CMS refusé — permission cms:read requise.
        </p>
      </main>
    );
  }

  return (
    <main className="admin cms-page" style={layout.cms}>
      <header className="admin-header">
        <div>
          <h1>CMS</h1>
          <p>Explorateur dossiers · articles multilingues (Phase 1).</p>
        </div>
      </header>

      <div className="cms-layout">
        <aside className="cms-sidebar status">
          <h2>Dossiers</h2>
          <Button
            variant={!selectedFolderId ? 'primary' : 'social'}
            onClick={() => setSelectedFolderId(null)}
          >
            Tous les articles
          </Button>
          <FolderTree
            nodes={folders}
            selectedId={selectedFolderId}
            onSelect={setSelectedFolderId}
          />

          {canCmsWrite ? (
            <form className="admin-form" onSubmit={onCreateFolder}>
              <h3>Nouveau dossier</h3>
              <Input
                placeholder="code (unique)"
                value={folderForm.code}
                onChange={(e) =>
                  setFolderForm((f) => ({ ...f, code: e.target.value }))
                }
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              />
              <Input
                placeholder="Nom"
                value={folderForm.name}
                onChange={(e) =>
                  setFolderForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
              <Button type="submit">Créer le dossier</Button>
            </form>
          ) : null}
        </aside>

        <section className="cms-main">
          <form
            className="admin-filters"
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}
          >
            <Input
              type="search"
              placeholder="Rechercher…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Recherche articles"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Statut"
            >
              <option value="">Tous les statuts</option>
              {Object.values(CmsArticleStatus).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Button type="submit">Filtrer</Button>
          </form>

          {loading ? <p>Chargement…</p> : null}

          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Slug</th>
                  <th>Titre</th>
                  <th>Dossier</th>
                  <th>Statut</th>
                  <th>Langues</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/cms/articles/${a.id}`}>{a.slug}</Link>
                    </td>
                    <td>{a.translations[0]?.title ?? '—'}</td>
                    <td>
                      <code>{a.folder?.code ?? '—'}</code>
                    </td>
                    <td>
                      <Badge variant="secondary">{a.status}</Badge>
                    </td>
                    <td>
                      {a.translations.map((t) => t.locale).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
                {!articles.length && !loading ? (
                  <tr>
                    <td colSpan={5}>Aucun article.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {canCmsWrite ? (
            <form className="admin-form status" onSubmit={onCreateArticle}>
              <h2>Nouvel article</h2>
              <p className="hint">
                Dossier sélectionné : <code>{selectedFolderId ?? 'aucun'}</code>
              </p>
              <Input
                placeholder="slug"
                value={articleForm.slug}
                onChange={(e) =>
                  setArticleForm((f) => ({ ...f, slug: e.target.value }))
                }
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              />
              <Input
                placeholder="Titre"
                value={articleForm.title}
                onChange={(e) =>
                  setArticleForm((f) => ({ ...f, title: e.target.value }))
                }
                required
              />
              <Input
                placeholder="locale (fr, en…)"
                value={articleForm.locale}
                onChange={(e) =>
                  setArticleForm((f) => ({ ...f, locale: e.target.value }))
                }
                required
              />
              <RichTextEditor
                placeholder="Contenu"
                value={articleForm.content}
                onChange={(content) =>
                  setArticleForm((f) => ({ ...f, content }))
                }
              />
              <Button type="submit" disabled={!selectedFolderId}>
                Créer l&apos;article
              </Button>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}
