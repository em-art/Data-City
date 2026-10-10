import { Pause, Play, Radio, Search, ShieldCheck, Truck, PackageCheck, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { displayName } from '@/model/graph';
import { useCity } from '@/store/city';
import { KIND_LABEL } from './util';

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone?: 'bad' }) {
  return (
    <div className={`kpi ${tone === 'bad' ? 'kpi--bad' : ''}`}>
      <div className="kpi__icon">{icon}</div>
      <div>
        <div className="kpi__label">{label}</div>
        <div className="kpi__value">{value}</div>
      </div>
    </div>
  );
}

function SearchBox() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const entities = useCity((s) => s.model.entities);
  const select = useCity((s) => s.select);
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return entities
      .filter((e) => e.kind !== 'relationship')
      .filter((e) => displayName(e).toLowerCase().includes(t) || e.id.includes(t))
      .slice(0, 8);
  }, [q, entities]);
  return (
    <div className="search">
      <Search size={16} />
      <input
        placeholder="Найти систему, продукт, сотрудника…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && hits.length > 0 && (
        <div className="search__results glass">
          {hits.map((e) => (
            <button
              key={e.id}
              onClick={() => {
                select(e.id, { focus: true });
                setQ('');
              }}
            >
              <span>{displayName(e)}</span>
              <small>{KIND_LABEL[e.kind]}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const stats = useCity((s) => s.stats);
  const source = useCity((s) => s.source);
  const liveStatus = useCity((s) => s.liveStatus);
  const playing = useCity((s) => s.playing);
  const rate = useCity((s) => s.rate);
  const { setPlaying, setRate, setSource } = useCity.getState();

  return (
    <header className="topbar">
      <div className="brand glass">
        <div className="brand__logo">D</div>
        <div>
          <div className="brand__name">Data City</div>
          <div className="brand__sub">Data Platform District</div>
        </div>
      </div>
      <div className="kpis glass">
        <Kpi icon={<Truck size={16} />} label="Отправлено" value={stats.dispatched} />
        <Kpi icon={<PackageCheck size={16} />} label="Доставлено" value={stats.delivered} />
        <Kpi icon={<ShieldCheck size={16} />} label="Проверок контракта" value={stats.checks} />
        <Kpi icon={<TriangleAlert size={16} />} label="Вне контракта" value={stats.violations} tone={stats.violations ? 'bad' : undefined} />
      </div>
      <SearchBox />
      <div className="sim-controls glass">
        <button
          className={`source source--${source}`}
          title={source === 'demo' ? 'Демонстрационный сценарий: анимация не отражает реальную работу компании' : 'Фактические события из источника'}
          onClick={() => setSource(source === 'demo' ? 'live' : 'demo')}
        >
          <Radio size={14} />
          {source === 'demo' ? 'ДЕМО-СЦЕНАРИЙ' : `ФАКТ · ${liveStatus === 'open' ? 'подключено' : liveStatus === 'error' ? 'нет источника' : 'подключение…'}`}
        </button>
        <button className="icon-btn" onClick={() => setPlaying(!playing)} title={playing ? 'Пауза' : 'Продолжить'}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <select value={rate} onChange={(e) => setRate(Number(e.target.value))} title="Скорость симуляции">
          {[0.5, 1, 2, 4].map((r) => (
            <option key={r} value={r}>
              ×{r}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
