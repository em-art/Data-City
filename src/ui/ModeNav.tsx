import { Building2, Database, FileJson, GitBranch, Lightbulb, Map, Network, Plus, Tags, Users } from 'lucide-react';
import type { ViewMode } from '@/store/city';
import { useCity } from '@/store/city';

export const MODES: { id: ViewMode; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'city', label: 'Город', hint: 'Районы, здания, дороги и инфраструктура', icon: <Map size={18} /> },
  { id: 'systems', label: 'Системы', hint: 'Приложения, коннекторы, интерфейсы и зависимости', icon: <Network size={18} /> },
  { id: 'data', label: 'Данные', hint: 'Источники, обработка, продукты и доставка', icon: <Database size={18} /> },
  { id: 'people', label: 'Люди и ноды', hint: 'Сотрудники, помощники и обмен контекстом через Нить', icon: <Users size={18} /> },
  { id: 'process', label: 'Процессы', hint: 'Маршрут задачи через объекты города, шаг за шагом', icon: <GitBranch size={18} /> },
  { id: 'metadata', label: 'Метаданные', hint: 'Владельцы, интерфейсы, контракты и разрешённые маршруты', icon: <Tags size={18} /> },
  { id: 'improve', label: 'Улучшения', hint: 'Ручные шаги, повторы, узкие места и предлагаемые изменения', icon: <Lightbulb size={18} /> },
];

export function ModeNav() {
  const view = useCity((s) => s.view);
  const { setView, setDialog } = useCity.getState();
  const current = MODES.find((m) => m.id === view)!;
  return (
    <>
      <nav className="modenav glass">
        {MODES.map((m) => (
          <button key={m.id} className={view === m.id ? 'active' : ''} onClick={() => setView(m.id)} title={m.label}>
            {m.icon}
            <span className="modenav__tip">{m.label}</span>
          </button>
        ))}
        <div className="modenav__sep" />
        <button onClick={() => setDialog('add')} title="Добавить объект">
          <Plus size={18} />
          <span className="modenav__tip">Добавить</span>
        </button>
        <button onClick={() => setDialog('export')} title="Модель: экспорт и импорт">
          <FileJson size={18} />
          <span className="modenav__tip">Модель · Mermaid</span>
        </button>
      </nav>
      <div className="lens-caption glass">
        <Building2 size={14} />
        <b>{current.label}</b>
        <span>{current.hint}</span>
      </div>
    </>
  );
}
