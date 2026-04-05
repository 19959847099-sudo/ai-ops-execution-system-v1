import { Routes, Route } from 'react-router-dom';
import { AppShell } from '../layouts/AppShell';
import { ProjectListPage } from '../pages/ProjectListPage';
import { ProjectHomePage } from '../pages/ProjectHomePage';
import { ProjectSettingsPage } from '../pages/ProjectSettingsPage';
import { ApiSettingsPage } from '../pages/ApiSettingsPage';
import { UserPreferencesPage } from '../pages/UserPreferencesPage';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<ProjectListPage />} />
        <Route path="/projects/:projectId" element={<ProjectHomePage />} />
        <Route path="/projects/:projectId/settings" element={<ProjectSettingsPage />} />
        <Route path="/settings/api" element={<ApiSettingsPage />} />
        <Route path="/settings/preferences" element={<UserPreferencesPage />} />
      </Route>
    </Routes>
  );
}
