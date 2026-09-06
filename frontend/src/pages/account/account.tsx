import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { Check, ImageUp, UserRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AVATARS,
  MAX_AVATAR_PHOTO_BYTES,
  avatarInitial,
  avatarSrc,
  isAvatarId,
  isPhotoAvatar,
} from "@/lib/avatars";
import { cn } from "@/lib/utils";
import {
  updateAvatar,
  updateProfile,
  uploadAvatarPhoto,
} from "@/features/user_slice";
import { AppDispatch, RootState } from "../../../app/store/store";
import type { UserProfile } from "@/types/user";

const PHONE_PATTERN = /^[+0-9() .\-]*$/;

const normalizeProfile = (profile?: UserProfile | null): UserProfile => ({
  jobTitle: profile?.jobTitle ?? "",
  department: profile?.department ?? "",
  branch: profile?.branch ?? "",
  phone: profile?.phone ?? "",
  bio: profile?.bio ?? "",
});

const Account = () => {
  const dispatch = useDispatch<AppDispatch>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { authUser, avatarLoading, profileLoading } = useSelector(
    (state: RootState) => state.user,
  );
  const user = authUser?.data?.user;
  const pictureSrc = avatarSrc(user?.avatar);
  const usingPhoto = isPhotoAvatar(user?.avatar);
  const usingInitials = !pictureSrc;
  const selectedPreset = isAvatarId(user?.avatar) ? user.avatar : null;
  const savedProfile = useMemo(
    () => normalizeProfile(user?.profile),
    [user?.profile],
  );
  const [profileForm, setProfileForm] = useState<UserProfile>(savedProfile);

  useEffect(() => {
    if (!user) {
      toast.error("You are not signed in");
    }
  }, [user]);

  useEffect(() => {
    setProfileForm(savedProfile);
  }, [savedProfile]);

  if (!user) {
    return null;
  }

  const fullName = [user.firstName, user.middleName, user.lastName]
    .filter(Boolean)
    .join(" ");
  const initial = avatarInitial(user.firstName || fullName, user.username);
  const profileDirty =
    (profileForm.jobTitle ?? "") !== (savedProfile.jobTitle ?? "") ||
    (profileForm.department ?? "") !== (savedProfile.department ?? "") ||
    (profileForm.branch ?? "") !== (savedProfile.branch ?? "") ||
    (profileForm.phone ?? "") !== (savedProfile.phone ?? "") ||
    (profileForm.bio ?? "") !== (savedProfile.bio ?? "");

  const handleSelect = async (avatar: string) => {
    if (avatarLoading) {
      return;
    }

    if (avatar === "" && usingInitials) {
      return;
    }

    if (avatar !== "" && avatar === selectedPreset) {
      return;
    }

    const result = await dispatch(updateAvatar(avatar));

    if (updateAvatar.fulfilled.match(result)) {
      toast.success(
        avatar === ""
          ? "Using the first letter of your name"
          : "Profile picture updated",
      );
      return;
    }

    toast.error(result.payload || "Failed to update profile picture");
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || avatarLoading) {
      return;
    }

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
      !/\.(jpe?g|png|webp)$/i.test(file.name)
    ) {
      toast.error("Use a JPEG, PNG, or WebP photo");
      return;
    }

    if (file.size > MAX_AVATAR_PHOTO_BYTES) {
      toast.error("Photo must be 2 MB or smaller");
      return;
    }

    const result = await dispatch(uploadAvatarPhoto(file));

    if (uploadAvatarPhoto.fulfilled.match(result)) {
      toast.success("Profile photo updated");
      return;
    }

    toast.error(result.payload || "Failed to upload photo");
  };

  const handleProfileSave = async (event: FormEvent) => {
    event.preventDefault();

    if (profileLoading || !profileDirty) {
      return;
    }

    const nextProfile = normalizeProfile(profileForm);

    if ((nextProfile.jobTitle ?? "").length > 80) {
      toast.error("Job title must be 80 characters or less");
      return;
    }
    if ((nextProfile.department ?? "").length > 80) {
      toast.error("Department must be 80 characters or less");
      return;
    }
    if ((nextProfile.branch ?? "").length > 80) {
      toast.error("Branch must be 80 characters or less");
      return;
    }
    if ((nextProfile.phone ?? "").length > 30) {
      toast.error("Phone must be 30 characters or less");
      return;
    }
    if (nextProfile.phone && !PHONE_PATTERN.test(nextProfile.phone)) {
      toast.error("Phone can only include numbers and + - ( ) .");
      return;
    }
    if ((nextProfile.bio ?? "").length > 500) {
      toast.error("About you must be 500 characters or less");
      return;
    }

    const result = await dispatch(updateProfile(nextProfile));

    if (updateProfile.fulfilled.match(result)) {
      toast.success("Professional details saved");
      return;
    }

    toast.error(result.payload || "Failed to save profile");
  };

  const professionalLine = [
    user.profile?.jobTitle,
    user.profile?.department,
    user.profile?.branch,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <UserRound className="size-5" />
          <h1 className="text-lg font-semibold">Account</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Your picture and optional professional details. Add only what you want
          to share.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Signed in as {user.username}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Avatar className="size-16 rounded-xl">
            {pictureSrc ? (
              <AvatarImage src={pictureSrc} alt={fullName} />
            ) : null}
            <AvatarFallback className="rounded-xl text-lg">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1 text-sm">
            <p className="font-medium">{fullName || user.username}</p>
            {professionalLine ? (
              <p className="text-muted-foreground">{professionalLine}</p>
            ) : null}
            <p className="text-muted-foreground">{user.email || "No email"}</p>
            <p className="text-muted-foreground">
              {user.role?.name || "No role"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile picture</CardTitle>
          <CardDescription>
            Upload your photo, use your initial, or choose a default avatar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              void handlePhotoChange(event);
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={usingPhoto ? "default" : "outline"}
              disabled={avatarLoading}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageUp />
              {usingPhoto ? "Change photo" : "Upload photo"}
            </Button>
            <Button
              type="button"
              variant={usingInitials ? "default" : "outline"}
              disabled={avatarLoading}
              onClick={() => {
                void handleSelect("");
              }}
            >
              Use initial
            </Button>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Default avatars</p>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
              {AVATARS.map((avatar) => {
                const isSelected = avatar.id === selectedPreset;

                return (
                  <Button
                    key={avatar.id}
                    type="button"
                    variant="outline"
                    disabled={avatarLoading}
                    aria-pressed={isSelected}
                    aria-label={avatar.label}
                    className={cn(
                      "relative h-auto overflow-hidden rounded-xl p-1",
                      isSelected && "ring-2 ring-primary",
                    )}
                    onClick={() => {
                      void handleSelect(avatar.id);
                    }}
                  >
                    <img
                      src={avatarSrc(avatar.id)}
                      alt=""
                      className="aspect-square w-full rounded-lg"
                    />
                    {isSelected ? (
                      <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" />
                      </span>
                    ) : null}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Professional details</CardTitle>
          <CardDescription>
            Optional. Add your role at work and how colleagues can reach you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              void handleProfileSave(event);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job title</Label>
                <Input
                  id="jobTitle"
                  maxLength={80}
                  placeholder="e.g. Terminal operations officer"
                  value={profileForm.jobTitle}
                  disabled={profileLoading}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      jobTitle: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  maxLength={80}
                  placeholder="e.g. Digital banking"
                  value={profileForm.department}
                  disabled={profileLoading}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      department: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch">Branch / office</Label>
                <Input
                  id="branch"
                  maxLength={80}
                  placeholder="e.g. Head office"
                  value={profileForm.branch}
                  disabled={profileLoading}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      branch: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  maxLength={30}
                  placeholder="Optional work or mobile number"
                  value={profileForm.phone}
                  disabled={profileLoading}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">About you</Label>
              <Textarea
                id="bio"
                maxLength={500}
                rows={4}
                placeholder="A short note about your work, if you want"
                value={profileForm.bio}
                disabled={profileLoading}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    bio: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                {(profileForm.bio ?? "").length}/500
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={profileLoading || !profileDirty}>
                Save details
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Account;
