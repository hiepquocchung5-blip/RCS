BEGIN;

CREATE TABLE milestone_certificates (
  id uuid PRIMARY KEY,
  verification_id uuid NOT NULL UNIQUE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  milestone_id uuid NOT NULL REFERENCES milestones(id) ON DELETE RESTRICT,
  project_name text NOT NULL,
  milestone_title text NOT NULL,
  client_name text NOT NULL,
  signed_off_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  signed_off_by_name text NOT NULL,
  signed_at timestamptz NOT NULL,
  signature text NOT NULL CHECK (signature ~ '^[a-f0-9]{64}$'),
  UNIQUE (milestone_id)
);

CREATE INDEX milestone_certificates_project_idx ON milestone_certificates(project_id);

COMMIT;
