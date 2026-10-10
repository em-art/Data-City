/**
 * Advances the simulation clock, schedules demo runs, publishes events
 * into the log and marks which objects are busy this frame.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { connectLive } from '@/adapters/live';
import { activity, clock } from '@/sim/clock';
import { sampleRun } from '@/sim/engine';
import { useCity, type LogEntry } from '@/store/city';

export function liveUrl(): string | null {
  const q = new URLSearchParams(window.location.search).get('live');
  return q || (import.meta.env.VITE_LIVE_EVENTS_URL as string | undefined) || null;
}

export function SimDriver() {
  const emitted = useRef(new Map<string, number>());
  const source = useCity((s) => s.source);

  useEffect(() => {
    if (source !== 'live') return;
    const url = liveUrl();
    const st = useCity.getState();
    if (!url) {
      st.setLiveStatus('error');
      return;
    }
    const conn = connectLive(url, {
      onEvent: (e) => useCity.getState().ingestLive(e),
      onStatus: (s) => useCity.getState().setLiveStatus(s),
      onReject: (raw, reason) => console.warn('[live] rejected event', reason, raw),
    });
    return () => conn.close();
  }, [source]);

  useFrame((_, rawDt) => {
    const s = useCity.getState();
    if (!s.playing) return;
    clock.t += Math.min(rawDt, 0.25) * s.rate;
    const t = clock.t;

    if (s.source === 'demo') {
      const last = s.runs[s.runs.length - 1];
      if (!last || t > last.startAt + (last.endAt - last.startAt) * 0.55) s.startDemoRun(t);
    }

    const fresh: LogEntry[] = [];
    activity.active.clear();
    for (const run of useCity.getState().runs) {
      let i = emitted.current.get(run.id) ?? 0;
      while (i < run.events.length && run.events[i]!.at <= t * 1000) {
        fresh.push({ ...run.events[i]!, runId: run.id });
        i++;
      }
      emitted.current.set(run.id, i);
      const ph = sampleRun(run, t, s.ctx).phase;
      if (ph && ph.kind !== 'travel') activity.active.set(ph.actorId, ph.kind);
    }
    if (fresh.length) s.pushEvents(fresh);
    if (emitted.current.size > 64) {
      const live = new Set(useCity.getState().runs.map((r) => r.id));
      for (const id of emitted.current.keys()) if (!live.has(id)) emitted.current.delete(id);
    }
  });
  return null;
}
