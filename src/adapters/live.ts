/**
 * Live event adapter. Connects to a Server-Sent Events endpoint that emits
 * `ModelEvent` JSON (see src/model/schema.ts). Every event is validated;
 * malformed events are dropped and reported, never animated.
 *
 * Try it locally: `npm run mock:live`, then open the app with
 * `?live=http://localhost:8787/events`.
 */
import { ModelEvent, type ModelEventT } from '@/model/schema';

export interface LiveConnection {
  close(): void;
}

export function connectLive(
  url: string,
  handlers: {
    onEvent(e: ModelEventT): void;
    onStatus(s: 'connecting' | 'open' | 'error'): void;
    onReject?(raw: unknown, reason: string): void;
  },
): LiveConnection {
  handlers.onStatus('connecting');
  const es = new EventSource(url);
  es.onopen = () => handlers.onStatus('open');
  es.onerror = () => handlers.onStatus('error');
  es.onmessage = (msg) => {
    let raw: unknown;
    try {
      raw = JSON.parse(msg.data);
    } catch {
      handlers.onReject?.(msg.data, 'not JSON');
      return;
    }
    const parsed = ModelEvent.safeParse({ ...(raw as object), source: 'live' });
    if (parsed.success) handlers.onEvent(parsed.data);
    else handlers.onReject?.(raw, parsed.error.issues.map((i) => i.message).join('; '));
  };
  return { close: () => es.close() };
}
