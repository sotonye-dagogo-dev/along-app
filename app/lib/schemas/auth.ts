import { z } from "zod";

export const LOGIN_SCHEMA = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false),
});

export const REGISTER_SCHEMA = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  userName: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const OTP_SCHEMA = z.object({
  email: z.string().email(),
  otp: z.string().length(6, "OTP must be 6 digits"),
  rememberMe: z.boolean().optional().default(false),
});
