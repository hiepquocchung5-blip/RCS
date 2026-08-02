-- Migration 005: Project proposals table
CREATE TABLE IF NOT EXISTS project_proposals (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    project_type VARCHAR(64) NOT NULL,
    tech_stack TEXT[] NOT NULL DEFAULT '{}',
    proposer_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    proposer_name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proposals_status ON project_proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_proposer ON project_proposals(proposer_id);
