export const AVATARS = [
  { id: "coral", label: "Coral" },
  { id: "amber", label: "Amber" },
  { id: "lime", label: "Lime" },
  { id: "teal", label: "Teal" },
  { id: "sky", label: "Sky" },
  { id: "indigo", label: "Indigo" },
  { id: "violet", label: "Violet" },
  { id: "rose", label: "Rose" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

const PHOTO_AVATAR_PATTERN =
  /^\/uploads\/avatars\/[a-f0-9]{24}-\d+\.(?:jpg|jpeg|png|webp)$/;

export const MAX_AVATAR_PHOTO_BYTES = 2 * 1024 * 1024;

export function isAvatarId(value?: string | null): value is AvatarId {
  return AVATARS.some((avatar) => avatar.id === value);
}

export function isPhotoAvatar(value?: string | null) {
  return Boolean(value && PHOTO_AVATAR_PATTERN.test(value));
}

export function avatarSrc(value?: string | null) {
  if (isAvatarId(value)) {
    return `/avatars/${value}.svg`;
  }

  if (isPhotoAvatar(value)) {
    return value!;
  }

  return undefined;
}

export function avatarInitial(name?: string, username?: string) {
  const source = (name || username || "?").trim();
  return source.slice(0, 1).toUpperCase();
}
