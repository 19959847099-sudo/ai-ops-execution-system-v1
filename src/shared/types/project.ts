export type ProjectStatus = 'active' | 'archived';
export type ProjectListFilter = ProjectStatus | 'all';

export type ProjectRecord = {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  oneLineDefinition: string | null;
  targetAudience: string | null;
  coreValue: string | null;
  currentFocus: string | null;
  forbiddenExpressions: string | null;
  fixedConstraints: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectInput = {
  name: string;
};

export type UpdateProjectSettingsInput = {
  name: string;
  oneLineDefinition: string;
  targetAudience: string;
  coreValue: string;
  currentFocus: string;
  forbiddenExpressions: string;
  fixedConstraints: string;
};

export type ProjectBridgeApi = {
  listProjects: (status?: ProjectListFilter) => Promise<ProjectRecord[]>;
  createProject: (input: CreateProjectInput) => Promise<ProjectRecord>;
  getProjectById: (projectId: string) => Promise<ProjectRecord | null>;
  archiveProject: (projectId: string) => Promise<ProjectRecord>;
  updateProjectSettings: (
    projectId: string,
    input: UpdateProjectSettingsInput,
  ) => Promise<ProjectRecord>;
};
