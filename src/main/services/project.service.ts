import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  CreateProjectInput,
  ProjectListFilter,
  ProjectRecord,
  ProjectStatus,
  UpdateProjectSettingsInput,
} from '../../shared/types/project';

export class ProjectService {
  constructor(private readonly db: Database.Database) {}

  getTableName(): string {
    return 'projects';
  }

  listProjects(status: ProjectListFilter = 'active'): ProjectRecord[] {
    const whereClause = status === 'all' ? '' : 'WHERE status = ?';
    const orderClause =
      status === 'archived'
        ? 'ORDER BY archived_at DESC, updated_at DESC'
        : 'ORDER BY created_at DESC, updated_at DESC';
    const statement = this.db.prepare(`
      SELECT
        id,
        name,
        slug,
        status,
        one_line_definition,
        target_audience,
        core_value,
        current_focus,
        forbidden_expressions,
        fixed_constraints,
        archived_at,
        created_at,
        updated_at
      FROM projects
      ${whereClause}
      ${orderClause}
    `);
    const rows =
      status === 'all'
        ? (statement.all() as ProjectRow[])
        : (statement.all(status) as ProjectRow[]);

    return rows.map((row) => this.mapRow(row));
  }

  createProject(input: CreateProjectInput): ProjectRecord {
    const name = input.name.trim();
    if (!name) {
      throw new Error('项目名称不能为空。');
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const slug = this.generateSlug(name, id);

    this.db
      .prepare(
        `
          INSERT INTO projects (
            id,
            name,
            slug,
            status,
            one_line_definition,
            target_audience,
            core_value,
            current_focus,
            forbidden_expressions,
            fixed_constraints,
            archived_at,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, 'active', NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)
        `,
      )
      .run(id, name, slug, now, now);

    const project = this.getProjectById(id);
    if (!project) {
      throw new Error('项目创建后读取失败。');
    }

    return project;
  }

  getProjectById(projectId: string): ProjectRecord | null {
    const row = this.db
      .prepare(
        `
          SELECT
            id,
            name,
            slug,
            status,
            one_line_definition,
            target_audience,
            core_value,
            current_focus,
            forbidden_expressions,
            fixed_constraints,
            archived_at,
            created_at,
            updated_at
          FROM projects
          WHERE id = ?
        `,
      )
      .get(projectId) as ProjectRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  archiveProject(projectId: string): ProjectRecord {
    const project = this.getProjectById(projectId);
    if (!project) {
      throw new Error('项目不存在。');
    }

    if (project.status === 'archived') {
      return project;
    }

    const now = new Date().toISOString();
    this.db
      .prepare(
        `
          UPDATE projects
          SET status = 'archived',
              archived_at = ?,
              updated_at = ?
          WHERE id = ?
        `,
      )
      .run(now, now, projectId);

    const archivedProject = this.getProjectById(projectId);
    if (!archivedProject) {
      throw new Error('项目归档后读取失败。');
    }

    return archivedProject;
  }

  updateProjectSettings(projectId: string, input: UpdateProjectSettingsInput): ProjectRecord {
    const project = this.getProjectById(projectId);
    if (!project) {
      throw new Error('项目不存在。');
    }

    const name = input.name.trim();
    if (!name) {
      throw new Error('项目名称不能为空。');
    }

    const now = new Date().toISOString();

    this.db
      .prepare(
        `
          UPDATE projects
          SET name = ?,
              one_line_definition = ?,
              target_audience = ?,
              core_value = ?,
              current_focus = ?,
              forbidden_expressions = ?,
              fixed_constraints = ?,
              updated_at = ?
          WHERE id = ?
        `,
      )
      .run(
        name,
        this.normalizeOptionalText(input.oneLineDefinition),
        this.normalizeOptionalText(input.targetAudience),
        this.normalizeOptionalText(input.coreValue),
        this.normalizeOptionalText(input.currentFocus),
        this.normalizeOptionalText(input.forbiddenExpressions),
        this.normalizeOptionalText(input.fixedConstraints),
        now,
        projectId,
      );

    const updatedProject = this.getProjectById(projectId);
    if (!updatedProject) {
      throw new Error('项目设置保存后读取失败。');
    }

    return updatedProject;
  }

  private generateSlug(name: string, id: string): string {
    const base = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `${base || 'project'}-${id.slice(0, 8)}`;
  }

  private normalizeOptionalText(value: string): string | null {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private mapRow(row: ProjectRow): ProjectRecord {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      oneLineDefinition: row.one_line_definition,
      targetAudience: row.target_audience,
      coreValue: row.core_value,
      currentFocus: row.current_focus,
      forbiddenExpressions: row.forbidden_expressions,
      fixedConstraints: row.fixed_constraints,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  one_line_definition: string | null;
  target_audience: string | null;
  core_value: string | null;
  current_focus: string | null;
  forbidden_expressions: string | null;
  fixed_constraints: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};
