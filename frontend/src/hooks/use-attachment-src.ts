"use client";

import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";

type AttachmentState = {
  attachment?: {
    type?: string;
    file?: File;
    content?: Array<{ type?: string; image?: string }>;
  };
};

function useAuiState<T>(selector: (state: AttachmentState) => T): T {
  return selector({});
}

const useFileSrc = (file: File | undefined) => {
  const [entry, setEntry] = useState<{ file: File; url: string } | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!file) {
      setEntry(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setEntry({ file, url: objectUrl });

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return entry !== undefined && entry.file === file ? entry.url : undefined;
};

export const useAttachmentSrc = () => {
  const { file, src } = useAuiState(
    useShallow((s: AttachmentState): { file?: File; src?: string } => {
      if (s.attachment?.type !== "image") return {};
      if (s.attachment.file) return { file: s.attachment.file };
      const src = s.attachment.content?.filter((c) => c.type === "image")[0]
        ?.image;
      if (!src) return {};
      return { src };
    }),
  );

  return useFileSrc(file) ?? src;
};
