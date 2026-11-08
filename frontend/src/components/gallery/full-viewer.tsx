"use client";

import type { FileItem } from "@galeriku/contracts";
import { MediaViewer } from "@/components/media-viewer/media-viewer";

export interface FullViewerProps {
  files: FileItem[];
  initialIndex: number;
  onClose: () => void;
  onOpenInfo?: (file: FileItem) => void;
  isInfoOpen?: boolean;
}

export function FullViewer({
  files,
  initialIndex,
  onClose,
  onOpenInfo,
  isInfoOpen,
}: FullViewerProps) {
  return (
    <MediaViewer
      files={files}
      initialIndex={initialIndex}
      onClose={onClose}
      onOpenInfo={onOpenInfo}
      isInfoOpen={isInfoOpen}
      adapter={{ mode: "owner" }}
    />
  );
}
