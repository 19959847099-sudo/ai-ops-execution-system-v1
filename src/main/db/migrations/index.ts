import { migration001 } from './001_init';
import { migration002 } from './002_project_settings_fields';
import { migration003 } from './003_assets_and_task_shell';
import { migration004 } from './004_task_generation_chain';

export const coreMigrations = [migration001, migration002, migration003, migration004];

export type CoreMigration = (typeof coreMigrations)[number];
