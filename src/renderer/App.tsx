import { useEffect } from 'react';
import { AppRouter } from './router';
import { useAppShellStore } from './store/app-shell.store';

function App() {
  const setSnapshot = useAppShellStore((state) => state.setSnapshot);
  const setLoading = useAppShellStore((state) => state.setLoading);
  const setError = useAppShellStore((state) => state.setError);

  useEffect(() => {
    let disposed = false;

    const loadBootstrap = async () => {
      setLoading(true);

      try {
        const snapshot = await window.coreApi.getBootstrapSnapshot();
        if (!disposed) {
          setSnapshot(snapshot);
        }
      } catch (error) {
        if (!disposed) {
          setError(error instanceof Error ? error.message : '底座初始化失败');
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    void loadBootstrap();

    return () => {
      disposed = true;
    };
  }, [setError, setLoading, setSnapshot]);

  return <AppRouter />;
}

export default App;
