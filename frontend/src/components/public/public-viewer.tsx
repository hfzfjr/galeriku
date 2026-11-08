"use client";

import type { FileItem } from "@galeriku/contracts";
import { MediaViewer } from "@/components/media-viewer/media-viewer";

export interface PublicViewerProps {
  token: string;
  files: FileItem[];
  initialIndex: number;
  allowDownload: boolean;
  onClose: () => void;
  onOpenInfo?: (file: FileItem) => void;
  isInfoOpen?: boolean;
}

export function PublicViewer({
  token,
  files,
  initialIndex,
  allowDownload,
  onClose,
  onOpenInfo,
  isInfoOpen,
}: PublicViewerProps) {
  return (
    <MediaViewer
      files={files}
      initialIndex={initialIndex}
      onClose={onClose}
      onOpenInfo={onOpenInfo}
      isInfoOpen={isInfoOpen}
      adapter={{
        mode: "public",
        token,
        allowDownload,
      }}
    />
  );
}
