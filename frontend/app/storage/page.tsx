'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileUploadKind, Permission } from '@saas-starter/shared';
import { FileUpload } from '@/components/file-upload';
import { Button } from '@/components/ui';
import { layout } from '@/lib/components';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/providers';
import {
  deleteFile,
  getStorageDriver,
  listFiles,
  type FileAssetRow,
} from '@/services/storage.service';

export default function StoragePage() {
  const { accessToken } = useAuth();
  const { can } = usePermissions();
  const toast = useToast();
  const canRead = can(Permission.UPLOAD_READ);
  const canWrite = can(Permission.UPLOAD_WRITE);
  const canDelete = can(Permission.UPLOAD_DELETE);

  const [kind, setKind] = useState<FileUploadKind>(FileUploadKind.IMAGE);
  const [driver, setDriver] = useState('—');
  const [files, setFiles] = useState<FileAssetRow[]>([]);

  const load = useCallback(async () => {
    if (!accessToken || !canRead) return;
    try {
      const [list, drv] = await Promise.all([
        listFiles(accessToken),
        getStorageDriver(accessToken),
      ]);
      setFiles(list);
      setDriver(drv.driver);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur storage');
    }
  }, [accessToken, canRead, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (id: string) => {
    if (!accessToken || !canDelete) return;
    try {
      await deleteFile(accessToken, id);
      toast.success('Fichier supprimé.');
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Suppression impossible',
      );
    }
  };

  if (!canRead) {
    return (
      <main className="admin" style={layout.main}>
        <p className="error">Accès storage refusé.</p>
      </main>
    );
  }

  return (
    <main className="admin storage-page" style={layout.main}>
      <header className="admin-header">
        <div>
          <h1>Fichiers</h1>
          <p>
            Driver actif : <code>{driver}</code> — image, document, avatar.
          </p>
        </div>
      </header>

      {canWrite ? (
        <section className="status">
          <div className="admin-filters">
            {(
              [
                FileUploadKind.IMAGE,
                FileUploadKind.DOCUMENT,
                FileUploadKind.AVATAR,
              ] as const
            ).map((k) => (
              <Button
                key={k}
                variant={kind === k ? 'primary' : 'social'}
                onClick={() => setKind(k)}
              >
                {k}
              </Button>
            ))}
          </div>
          {accessToken ? (
            <FileUpload
              accessToken={accessToken}
              kind={kind}
              onUploaded={() => void load()}
            />
          ) : null}
        </section>
      ) : null}

      <section>
        <h2>Mes fichiers</h2>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type</th>
                <th>Taille</th>
                <th>URL</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id}>
                  <td>{f.originalName}</td>
                  <td>
                    {f.kind} · {f.mimeType}
                  </td>
                  <td>{Math.round(f.size / 1024)} Ko</td>
                  <td>
                    <a href={f.url} target="_blank" rel="noreferrer">
                      Voir
                    </a>
                  </td>
                  <td>
                    {canDelete ? (
                      <Button
                        variant="social"
                        onClick={() => void onDelete(f.id)}
                      >
                        Supprimer
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {files.length === 0 ? (
                <tr>
                  <td colSpan={5} className="hint">
                    Aucun fichier.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
