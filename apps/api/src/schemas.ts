import { z } from "zod";

const roles = ["admin", "pm", "devops", "frontend", "backend"] as const;
const skillLevels = ["intern", "junior", "mid", "senior"] as const;
const projectTypes = ["web_app", "mobile_app", "api_service", "ecommerce", "ai_ml", "devops_infra", "design_system"] as const;

export const applicationSchema = z.object({ email: z.string().trim().email().max(320), name: z.string().trim().min(1).max(120), githubUrl: z.string().url().max(500), requestedRole: z.enum(roles).exclude(["admin"]), skillLevel: z.enum(skillLevels) }).strict();
export const loginSchema = z.object({ email: z.string().trim().email().max(320), password: z.string().length(16) }).strict();
export const otpSchema = z.object({ applicationId: z.string().uuid(), otp: z.string().regex(/^\d{6}$/) }).strict();
export const orderSchema = z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(320), company: z.string().trim().max(160).default(""), projectType: z.enum(projectTypes), brief: z.string().trim().min(10).max(10_000) }).strict();
export const milestoneSchema = z.object({ title: z.string().trim().min(1).max(200), dueDate: z.string().date() }).strict();
export const projectDeliverySchema = z.object({ deadline: z.string().date().nullable().optional(), ownerId: z.string().uuid().nullable().optional(), health: z.enum(["on_track", "at_risk", "blocked"]).optional() }).strict();
export function validationError(error: z.ZodError) { return { error: "request validation failed", issues: error.issues }; }
