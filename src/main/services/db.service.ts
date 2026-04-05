import Database from 'better-sqlite3';
import { coreMigrations } from '../db/migrations';

export class DbService {
  private db: Database.Database | null = null;

  constructor(private readonly databasePath: string) {}

  initialize(): Database.Database {
    if (this.db) {
      return this.db;
    }

    const database = new Database(this.databasePath);
    database.pragma('journal_mode = WAL');
    this.ensureMigrationTable(database);
    this.runMigrations(database);
    this.db = database;

    return database;
  }

  getConnection(): Database.Database {
    if (!this.db) {
      throw new Error('Database has not been initialized.');
    }

    return this.db;
  }

  getAppliedMigrations(): string[] {
    const database = this.getConnection();
    const rows = database.prepare('SELECT name FROM schema_migrations ORDER BY id ASC').all() as Array<{
      name: string;
    }>;

    return rows.map((row) => row.name);
  }

  private ensureMigrationTable(database: Database.Database): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL
      );
    `);
  }

  private runMigrations(database: Database.Database): void {
    const applied = new Set(
      (database.prepare('SELECT name FROM schema_migrations').all() as Array<{ name: string }>).map(
        (row) => row.name,
      ),
    );

    for (const migration of coreMigrations) {
      if (applied.has(migration.name)) {
        continue;
      }

      const applyMigration = database.transaction(() => {
        migration.up(database);
        database
          .prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)')
          .run(migration.name, new Date().toISOString());
      });

      applyMigration();
    }
  }
}
