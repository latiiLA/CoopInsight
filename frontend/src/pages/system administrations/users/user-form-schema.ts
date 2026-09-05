import { z } from "zod";

export const USER_STATUSES = [
  "new",
  "active",
  "inactive",
  "suspended",
  "deactivated",
] as const;

export const nameSchema = (fieldName: string, minLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${fieldName} is required`)
    .min(minLength, `${fieldName} must be at least ${minLength} characters`)
    .regex(/^[a-zA-Z\s]+$/, `${fieldName} can only contain letters and spaces`);

const profileFields = {
  firstName: nameSchema("First name", 3),
  middleName: nameSchema("Father name", 3),
  lastName: nameSchema("Grandfather name", 3),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  role: z.string().min(1, "Role is required"),
  permissions: z.array(z.string()),
};

export const createUserFormSchema = z.object({
  ...profileFields,
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 characters")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Username can only contain letters, numbers, dots, underscores and hyphens",
    ),
});

export const editUserFormSchema = z.object({
  ...profileFields,
  status: z.enum(USER_STATUSES),
});

export type CreateUserFormValues = z.infer<typeof createUserFormSchema>;
export type EditUserFormValues = z.infer<typeof editUserFormSchema>;

export const formatLabel = (value?: string | null) => {
  if (!value) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
};
