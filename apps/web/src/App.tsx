import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/app-shell';
import { ComparePage } from './pages/compare-page';
import { RunDetailPage } from './pages/run-detail-page';
import { RunsPage } from './pages/runs-page';

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<RunsPage />} />
        <Route path="/runs/:runId" element={<RunDetailPage />} />
        <Route path="/compare" element={<ComparePage />} />
      </Route>
    </Routes>
  );
}
