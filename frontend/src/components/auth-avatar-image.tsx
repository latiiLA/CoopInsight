import type { ComponentProps } from "react";

import { AvatarImage } from "@/components/ui/avatar";
import { useAuthFileUrl } from "@/hooks/use-auth-file-url";

type AuthAvatarImageProps = ComponentProps<typeof AvatarImage>;

/**
 * AvatarImage that loads /uploads/* via an authenticated fetch (blob URL).
 * Preset /avatars/* paths pass through unchanged.
 */
export function AuthAvatarImage({ src, ...props }: AuthAvatarImageProps) {
  const resolved = useAuthFileUrl(typeof src === "string" ? src : undefined);
  if (!resolved) {
    return null;
  }
  return <AvatarImage src={resolved} {...props} />;
}
