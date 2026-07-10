BEGIN;

CREATE TYPE rcs_role AS ENUM ('admin', 'pm', 'devops', 'frontend', 'backend');
CREATE TYPE skill_level AS ENUM ('intern', 'junior', 'mid', 'senior');
CREATE TYPE project_health AS ENUM ('on_track', 'at_risk', 'blocked');
CREATE TYPE ticket_status AS ENUM ('todo', 'in_progress', 'review', 'complete');
CREATE TYPE milestone_status AS ENUM ('planned', 'active', 'complete');

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role rcs_role NOT NULL,
  skill_level skill_level NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE developer_applications (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  name text NOT NULL,
  github_url text NOT NULL,
  requested_role rcs_role NOT NULL,
  skill_level skill_level NOT NULL,
  status text NOT NULL CHECK (status IN ('pending_otp','otp_verified','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL,
  description text NOT NULL,
  client_name text NOT NULL DEFAULT '',
  is_public boolean NOT NULL DEFAULT false,
  tech_stack text[] NOT NULL DEFAULT '{}',
  deadline date,
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  health project_health NOT NULL DEFAULT 'on_track',
  source_order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE resource_requirements (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role rcs_role NOT NULL,
  skill_level skill_level NOT NULL,
  seat_count integer NOT NULL CHECK (seat_count BETWEEN 1 AND 20)
);

CREATE TABLE project_members (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE milestones (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_date date NOT NULL,
  status milestone_status NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tickets (
  id uuid PRIMARY KEY,
  ref text NOT NULL UNIQUE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  status ticket_status NOT NULL DEFAULT 'todo',
  assignee_role rcs_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE client_orders (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  company text NOT NULL DEFAULT '',
  project_type text NOT NULL,
  brief text NOT NULL,
  status text NOT NULL CHECK (status IN ('new','reviewed','converted')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ADD CONSTRAINT projects_source_order_fk
  FOREIGN KEY (source_order_id) REFERENCES client_orders(id) ON DELETE SET NULL;

CREATE TABLE magic_links (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_credential text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE TABLE activity_log (
  id uuid PRIMARY KEY,
  actor text NOT NULL,
  action text NOT NULL,
  detail text NOT NULL,
  request_id uuid,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE webhook_deliveries (
  delivery_id text PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tickets_project_status_idx ON tickets(project_id, status);
CREATE INDEX project_members_user_idx ON project_members(user_id);
CREATE INDEX milestones_project_due_idx ON milestones(project_id, due_date);
CREATE INDEX activity_created_idx ON activity_log(created_at DESC);

COMMIT;
