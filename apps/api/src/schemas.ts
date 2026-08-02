import { z } from "zod";

const roles = ["admin", "pm", "devops", "frontend", "backend"] as const;
const skillLevels = ["intern", "junior", "mid", "senior"] as const;
const projectTypes = ["web_app", "mobile_app", "api_service", "ecommerce", "ai_ml", "devops_infra", "design_system"] as const;

export const applicationSchema = z.object({ email: z.string().trim().email().max(320), name: z.string().trim().min(1).max(120), githubUrl: z.string().url().max(500), requestedRole: z.enum(roles).exclude(["admin"]), skillLevel: z.enum(skillLevels) }).strict();
export const loginSchema = z.object({ email: z.string().trim().email().max(320), password: z.string().length(16) }).strict();
export const otpSchema = z.object({ applicationId: z.string().uuid(), otp: z.string().regex(/^\d{6}$/) }).strict();
export const orderSchema = z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(320), company: z.string().trim().max(160).default(""), telegramUsername: z.string().trim().max(80).optional().default(""), projectType: z.enum(projectTypes), brief: z.string().trim().min(10).max(10_000) }).strict();
export const milestoneSchema = z.object({ title: z.string().trim().min(1).max(200), dueDate: z.string().date() }).strict();
export const projectDeliverySchema = z.object({ deadline: z.string().date().nullable().optional(), ownerId: z.string().uuid().nullable().optional(), health: z.enum(["on_track", "at_risk", "blocked"]).optional() }).strict();

export const resourceRequirementSchema = z.object({
  role: z.enum(roles).exclude(["admin", "pm"]),
  skillLevel: z.enum(skillLevels),
  count: z.number().int().min(1).max(20),
}).strict();

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(projectTypes),
  description: z.string().trim().max(10_000),
  clientName: z.string().trim().max(120).optional().default(""),
  isPublic: z.boolean().optional().default(false),
  techStack: z.array(z.string().trim().min(1).max(50)).max(50),
  resourceMatrix: z.array(resourceRequirementSchema).max(20).optional().default([]),
}).strict();

export const assignTeamMemberSchema = z.object({
  userId: z.string().uuid(),
}).strict();

export const updateTechStackSchema = z.object({
  add: z.string().trim().min(1).max(50).optional(),
  remove: z.string().trim().min(1).max(50).optional(),
}).strict().refine((data) => data.add !== undefined || data.remove !== undefined, {
  message: "Either 'add' or 'remove' is required",
});

export const createTicketSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10_000),
  assigneeRole: z.enum(roles),
  projectId: z.string().uuid(),
}).strict();

export const transitionTicketSchema = z.object({
  to: z.enum(["todo", "in_progress", "review", "complete"]),
}).strict();

export function validationError(error: z.ZodError) { return { error: "request validation failed", issues: error.issues }; }
