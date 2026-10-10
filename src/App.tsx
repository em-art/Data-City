import { CityCanvas } from '@/scene/CityCanvas';
import { useCity } from '@/store/city';
import { AddDialog, ExportDialog } from '@/ui/Dialogs';
import { Inspector } from '@/ui/Inspector';
import { ModeNav } from '@/ui/ModeNav';
import { DeliveriesPanel, EventLogPanel, ImprovePanel, OverviewPanel, ProcessPanel } from '@/ui/Panels';
import { TopBar } from '@/ui/TopBar';

export function App() {
  const selectedId = useCity((s) => s.selectedId);
  const view = useCity((s) => s.view);
  const dialog = useCity((s) => s.dialog);
  return (
    <div className="app">
      <div className="stage">
        <CityCanvas />
      </div>
      <TopBar />
      <ModeNav />
      {selectedId ? <Inspector /> : <OverviewPanel />}
      <div className="bottom">
        <DeliveriesPanel />
        <ProcessPanel />
        {view === 'improve' ? <ImprovePanel /> : <EventLogPanel />}
      </div>
      {dialog === 'add' && <AddDialog />}
      {dialog === 'export' && <ExportDialog />}
    </div>
  );
}
