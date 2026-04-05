import type Database from 'better-sqlite3';

export const migration002 = {
  name: '002_project_settings_fields',
  up(db: Database.Database) {
    db.exec(`
      ALTER TABLE projects ADD COLUMN one_line_definition TEXT;
      ALTER TABLE projects ADD COLUMN target_audience TEXT;
      ALTER TABLE projects ADD COLUMN core_value TEXT;
      ALTER TABLE projects ADD COLUMN current_focus TEXT;
      ALTER TABLE projects ADD COLUMN forbidden_expressions TEXT;
      ALTER TABLE projects ADD COLUMN fixed_constraints TEXT;
    `);
  },
};
