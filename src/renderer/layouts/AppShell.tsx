import { NavLink, Outlet } from 'react-router-dom';
import { useAppShellStore } from '../store/app-shell.store';

const navItems = [
  { to: '/', label: '项目列表' },
  { to: '/settings/api', label: 'API 设置' },
  { to: '/settings/preferences', label: '用户偏好' },
];

export function AppShell() {
  const snapshot = useAppShellStore((state) => state.snapshot);
  const isLoading = useAppShellStore((state) => state.isLoading);
  const error = useAppShellStore((state) => state.error);

  return (
    <div className="app-shell">
      <aside className="shell-sidebar">
        <div>
          <p className="eyebrow">阶段 1 第 5 步</p>
          <h1>AI 运营执行系统 V1</h1>
          <p className="shell-subtitle">
            当前聚焦固定单 API（千问）系统配置，用于维护接口地址、模型、密钥与本地路径设置。
          </p>
        </div>

        <nav className="shell-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <section className="status-panel">
          <h2>底座状态</h2>
          <p>{isLoading ? '正在读取底座初始化信息...' : '底座信息已加载'}</p>
          {error ? <p className="error-text">{error}</p> : null}
          {snapshot ? (
            <ul className="status-list">
              <li>数据库：{snapshot.database.path}</li>
              <li>项目根目录：{snapshot.paths.projectRootDir}</li>
              <li>日志目录：{snapshot.paths.logsDir}</li>
              <li>Provider：{snapshot.systemSettings.providerName}</li>
            </ul>
          ) : null}
        </section>
      </aside>

      <main className="shell-content">
        <Outlet />
      </main>
    </div>
  );
}
