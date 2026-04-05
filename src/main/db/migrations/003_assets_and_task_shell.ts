import type Database from 'better-sqlite3';

export const migration003 = {
  name: '003_assets_and_task_shell',
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        asset_type TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_extension TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        relative_path TEXT NOT NULL,
        text_content TEXT,
        status TEXT NOT NULL DEFAULT 'ready',
        last_used_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id)
      );

      CREATE INDEX IF NOT EXISTS idx_assets_project_id ON assets(project_id);
      CREATE INDEX IF NOT EXISTS idx_assets_project_type ON assets(project_id, asset_type);
      CREATE INDEX IF NOT EXISTS idx_assets_project_updated_at ON assets(project_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id)
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);

      CREATE TABLE IF NOT EXISTS task_assets (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        added_at TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        FOREIGN KEY(task_id) REFERENCES tasks(id),
        FOREIGN KEY(asset_id) REFERENCES assets(id),
        UNIQUE(task_id, asset_id)
      );

      CREATE INDEX IF NOT EXISTS idx_task_assets_task_id ON task_assets(task_id, sort_order ASC, added_at ASC);
    `);
  },
};
