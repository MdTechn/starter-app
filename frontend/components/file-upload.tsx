'use client';

import { useRef, useState } from 'react';
import { FileUploadKind } from '@saas-starter/shared';
import { Button } from '@/components/ui';
import { useToast } from '@/providers';
import {
  uploadFile,
  type FileAssetRow,
  type UploadProgress,
} from '@/services/storage.service';

type Props = {
  accessToken: string;
  kind?: FileUploadKind;
  accept?: string;
  ownerType?: string;
  ownerId?: string;
  onUploaded?: (asset: FileAssetRow) => void;
};

const KIND_ACCEPT: Record<FileUploadKind, string> = {
  [FileUploadKind.IMAGE]: 'image/jpeg,image/png,image/webp,image/gif',
  [FileUploadKind.DOCUMENT]: '.pdf,.doc,.docx,.txt,application/pdf,text/plain',
  [FileUploadKind.AVATAR]: 'image/jpeg,image/png,image/webp',
};

export function FileUpload({
  accessToken,
  kind = FileUploadKind.IMAGE,
  accept,
  ownerType,
  ownerId,
  onUploaded,
}: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<FileAssetRow | null>(null);

  const onPick = (file: File | null) => {
    setLast(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const onSubmit = async () => {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      toast.warning('Choisissez un fichier.');
      return;
    }
    setBusy(true);
    setProgress({ loaded: 0, total: file.size, percent: 0 });
    try {
      const asset = await uploadFile(accessToken, file, kind, {
        ownerType,
        ownerId,
        onProgress: setProgress,
      });
      setLast(asset);
      toast.success('Fichier uploadé.');
      onUploaded?.(asset);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec de l’upload');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="upload-widget">
      <label className="upload-field">
        <span>Fichier ({kind})</span>
        <input
          ref={inputRef}
          type="file"
          accept={accept ?? KIND_ACCEPT[kind]}
          disabled={busy}
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
      </label>

      {previewUrl ? (
        <img src={previewUrl} alt="Aperçu" className="upload-preview" />
      ) : null}

      {progress ? (
        <div
          className="upload-progress"
          role="progressbar"
          aria-valuenow={progress.percent}
        >
          <div
            className="upload-progress-bar"
            style={{ width: `${progress.percent}%` }}
          />
          <span>{progress.percent}%</span>
        </div>
      ) : null}

      {last ? (
        <p className="ok">
          Uploadé —{' '}
          <a href={last.url} target="_blank" rel="noreferrer">
            ouvrir
          </a>
        </p>
      ) : null}

      <Button
        type="button"
        variant="primary"
        fullWidth
        disabled={busy}
        onClick={() => void onSubmit()}
      >
        {busy ? 'Envoi…' : 'Envoyer'}
      </Button>
    </div>
  );
}
