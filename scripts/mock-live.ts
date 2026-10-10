/**
 * Minimal SSE server emitting ModelEvents, to exercise the live mode
 * without real integrations. Run: npm run mock:live
 */
import { createServer } from 'node:http';

const legs: [string, string, string | undefined][] = [
  ['sys.eva', 'sys.data-platform', undefined],
  ['sys.data-platform', 'sys.product-warehouse', 'dp.subscriber-base'],
  ['sys.product-warehouse', 'sys.istok', 'dp.subscriber-base'],
  ['sys.istok', 'sys.bi', 'dp.subscriber-base'],
];

let n = 0;
createServer((req, res) => {
  if (!req.url?.startsWith('/events')) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  });
  const timer = setInterval(() => {
    const [fromId, toId, cargo] = legs[n % legs.length]!;
    const event = {
      id: `live-${n++}`,
      at: Date.now(),
      type: 'product.dispatched',
      subjectId: cargo ?? fromId,
      payload: { fromId, toId },
    };
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (n % 7 === 0) {
      res.write(`data: ${JSON.stringify({ id: `live-${n++}`, at: Date.now(), type: 'system.status', subjectId: 'sys.eva', payload: { status: n % 14 === 0 ? 'healthy' : 'degraded' } })}\n\n`);
    }
  }, 2500);
  req.on('close', () => clearInterval(timer));
}).listen(8787, () => console.log('mock live events on http://localhost:8787/events'));
