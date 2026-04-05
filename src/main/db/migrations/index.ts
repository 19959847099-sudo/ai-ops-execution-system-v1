import { migration001 } from './001_init';
import { migration002 } from './002_project_settings_fields';

export const coreMigrations = [migration001, migration002];

export type CoreMigration = (typeof coreMigrations)[number];
