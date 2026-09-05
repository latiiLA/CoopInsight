import { z } from "zod";

export const roleFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Role name must be at least 3 characters")
    .max(50, "Role name must be at most 50 characters")
    .regex(
      /^[a-zA-Z0-9\s_-]+$/,
      "Role name can only contain letters, numbers, spaces, underscores and hyphens",
    ),
  permissions: z
    .array(z.string())
    .min(1, "Select at least one permission for this role"),
});

export type RoleFormValues = z.infer<typeof roleFormSchema>;
