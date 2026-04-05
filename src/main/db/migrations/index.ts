import { migration001 } from './001_init';
import { migration002 } from './002_project_settings_fields';
import { migration003 } from './003_assets_and_task_shell';

export const coreMigrations = [migration001, migration002, migration003];

export type CoreMigration = (typeof coreMigrations)[number];
