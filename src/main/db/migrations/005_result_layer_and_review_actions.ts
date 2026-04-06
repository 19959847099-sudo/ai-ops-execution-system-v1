import type Database from 'better-sqlite3';

export const migration005 = {
  name: '005_result_layer_and_review_actions',
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_results (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        source_result_id TEXT,
        result_type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        structured_description TEXT,
        segments_json TEXT,
        status TEXT NOT NULL DEFAULT 'pending_review',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES tasks(id),
        FOREIGN KEY(project_id) REFERENCES projects(id),
        FOREIGN KEY(source_result_id) REFERENCES task_results(id)
      );

      CREATE INDEX IF NOT EXISTS idx_task_results_task_id
      ON task_results(task_id, updated_at DESC, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_task_results_project_id
      ON task_results(project_id, updated_at DESC, created_at DESC);

      CREATE TABLE IF NOT EXISTS result_review_actions (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        result_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        related_asset_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES tasks(id),
        FOREIGN KEY(result_id) REFERENCES task_results(id),
        FOREIGN KEY(related_asset_id) REFERENCES assets(id)
      );

      CREATE INDEX IF NOT EXISTS idx_result_review_actions_task_id
      ON result_review_actions(task_id, created_at DESC);

      INSERT INTO task_results (
        id,
        task_id,
        project_id,
        source_result_id,
        result_type,
        title,
        body,
        structured_description,
        segments_json,
        status,
        created_at,
        updated_at
      )
      SELECT
        tc.id,
        tc.task_id,
        t.project_id,
        NULL,
        tc.candidate_type,
        tc.title,
        tc.body,
        tc.structured_description,
        tc.segments_json,
        'pending_review',
        tc.generated_at,
        tc.generated_at
      FROM task_candidates tc
      INNER JOIN tasks t ON t.id = tc.task_id
      WHERE NOT EXISTS (
        SELECT 1 FROM task_results tr WHERE tr.id = tc.id
      );
    `);
  },
};
