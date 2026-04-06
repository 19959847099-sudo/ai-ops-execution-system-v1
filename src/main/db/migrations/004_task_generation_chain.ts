import type Database from 'better-sqlite3';

export const migration004 = {
  name: '004_task_generation_chain',
  up(db: Database.Database) {
    db.exec(`
      ALTER TABLE tasks ADD COLUMN goal TEXT NOT NULL DEFAULT '';
      ALTER TABLE tasks ADD COLUMN task_form TEXT NOT NULL DEFAULT 'article';
      ALTER TABLE tasks ADD COLUMN supplemental_requirements TEXT NOT NULL DEFAULT '';

      CREATE TABLE IF NOT EXISTS task_candidates (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        candidate_type TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        structured_description TEXT,
        segments_json TEXT,
        generated_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES tasks(id),
        UNIQUE(task_id, sequence)
      );

      CREATE INDEX IF NOT EXISTS idx_task_candidates_task_id
      ON task_candidates(task_id, sequence ASC, generated_at ASC);
    `);
  },
};
