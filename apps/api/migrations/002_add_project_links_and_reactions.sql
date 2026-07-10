ALTER TABLE projects ADD COLUMN git_link text;
ALTER TABLE projects ADD COLUMN live_link text;
ALTER TABLE projects ADD COLUMN views integer NOT NULL DEFAULT 0;

CREATE TABLE showcase_reactions (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_session_id text NOT NULL,
  reaction_type text NOT NULL,
  PRIMARY KEY (project_id, user_session_id, reaction_type)
);
