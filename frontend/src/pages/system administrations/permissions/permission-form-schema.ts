import { z } from "zod";

const slugSchema = (fieldName: string) =>
  z
    .string()
    .trim()
    .min(2, `${fieldName} must be at least 2 characters`)
    .max(50, `${fieldName} must be at most 50 characters`)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      `${fieldName} can only contain letters, numbers, underscores and hyphens`,
    );

export const permissionFormSchema = z.object({
  resource: slugSchema("Resource"),
  action: slugSchema("Action"),
  description: z.string().trim().max(200, "Description is too long").optional(),
});

export type PermissionFormValues = z.infer<typeof permissionFormSchema>;
