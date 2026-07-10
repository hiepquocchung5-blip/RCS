import type {
  ClientOrder,
  DeveloperApplication,
  Milestone,
  Project,
  SystemLogEntry,
  Ticket,
  UserProfile,
} from "@rcs/shared";

export interface UserRepository {
  findByEmail(email: string): Promise<UserProfile | null>;
  findById(id: string): Promise<UserProfile | null>;
  list(): Promise<readonly UserProfile[]>;
}

export interface ProjectRepository {
  findById(id: string): Promise<Project | null>;
  listForUser(userId: string, portfolioWide: boolean): Promise<readonly Project[]>;
  listMilestones(projectId: string): Promise<readonly Milestone[]>;
}

export interface DeliveryRepository {
  listTicketsForUser(userId: string, portfolioWide: boolean): Promise<readonly Ticket[]>;
}

export interface OperationsRepository {
  listApplications(): Promise<readonly DeveloperApplication[]>;
  listOrders(): Promise<readonly ClientOrder[]>;
  listActivity(): Promise<readonly SystemLogEntry[]>;
}

export interface RepositoryUnit {
  users: UserRepository;
  projects: ProjectRepository;
  delivery: DeliveryRepository;
  operations: OperationsRepository;
  healthcheck(): Promise<void>;
  close(): Promise<void>;
}
