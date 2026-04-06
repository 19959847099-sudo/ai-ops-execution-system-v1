import type Database from 'better-sqlite3';

export const migration006 = {
  name: '006_feedback_and_recent_memories',
  up(db: Database.Database) {
    db.exec(`
      ALTER TABLE tasks ADD COLUMN loop_status TEXT NOT NULL DEFAULT 'pending';
      ALTER TABLE tasks ADD COLUMN last_failure_at TEXT;
      ALTER TABLE tasks ADD COLUMN last_failure_reason TEXT;

      ALTER TABLE task_results ADD COLUMN cover_text TEXT NOT NULL DEFAULT '';

      CREATE TABLE IF NOT EXISTS result_auto_feedbacks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        result_id TEXT NOT NULL,
        feedback_type TEXT NOT NULL,
        feedback_text TEXT NOT NULL,
        asset_id TEXT,
        status TEXT NOT NULL,
        error_message TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id),
        FOREIGN KEY(task_id) REFERENCES tasks(id),
        FOREIGN KEY(result_id) REFERENCES task_results(id),
        FOREIGN KEY(asset_id) REFERENCES assets(id)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_result_auto_feedbacks_unique
      ON result_auto_feedbacks(result_id, feedback_type);

      CREATE INDEX IF NOT EXISTS idx_result_auto_feedbacks_task_id
      ON result_auto_feedbacks(task_id, updated_at DESC, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_result_auto_feedbacks_project_id
      ON result_auto_feedbacks(project_id, updated_at DESC, created_at DESC);

      CREATE TABLE IF NOT EXISTS recent_temporary_memories (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        result_id TEXT NOT NULL,
        summary_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id),
        FOREIGN KEY(task_id) REFERENCES tasks(id),
        FOREIGN KEY(result_id) REFERENCES task_results(id)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_recent_temporary_memories_unique
      ON recent_temporary_memories(task_id, result_id, summary_text);

      CREATE INDEX IF NOT EXISTS idx_recent_temporary_memories_project_id
      ON recent_temporary_memories(project_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_recent_temporary_memories_expires_at
      ON recent_temporary_memories(expires_at);
    `);
  },
};
