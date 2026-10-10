import { useEffect, useState } from 'react';
import type { EntityT } from '@/model/schema';

/** Re-render periodically to read the mutable sim clock in UI. */
export function useTick(hz = 4) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), 1000 / hz);
    return () => clearInterval(id);
  }, [hz]);
}

export const KIND_LABEL: Record<EntityT['kind'], string> = {
  domain: 'Домен',
  system: 'Система',
  employee: 'Сотрудник · нода',
  dataProduct: 'Продукт данных',
  contract: 'Контракт',
  connector: 'Коннектор',
  process: 'Процесс',
  relationship: 'Связь',
};

export const ROLE_LABEL: Record<string, string> = {
  source: 'Источник',
  processing: 'Обработка',
  storage: 'Хранение',
  delivery: 'Доставка',
  consumer: 'Потребитель',
  engineering: 'Инженерия',
  operations: 'Операции',
  metadata: 'Метаданные',
  context: 'Контекст',
};

export const EVENT_LABEL: Record<string, string> = {
  'step.started': 'Шаг начат',
  'step.completed': 'Шаг завершён',
  'product.produced': 'Продукт выпущен',
  'product.dispatched': 'Отправлен',
  'contract.checked': 'Контракт проверен',
  'product.delivered': 'Доставлен',
  'context.shared': 'Передан контекст',
  'system.status': 'Статус системы',
};

export const fmtSec = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} мин ${Math.round(s % 60)} с` : `${s.toFixed(1)} с`);

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[а-яё]/g, (ch) => {
      const map: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
      return map[ch] ?? '';
    })
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
