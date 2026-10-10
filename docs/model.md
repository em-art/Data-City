# Модель предприятия — Mermaid

> Сгенерировано из `src/data/enterprise.json` командой `npm run export:mermaid`. Не редактировать вручную.

## Связи систем

```mermaid
flowchart LR
  subgraph dom_data["Домен данных"]
    sys_data_platform["Data Platform"]
    sys_product_warehouse["Склад продуктов данных"]
    sys_metadata["Каталог метаданных"]
    sys_nit["Нить"]
    sys_istok["ИСТОК"]
    emp_data_engineer(("Анна — инженер данных"))
    emp_product_owner(("Игорь — владелец продукта"))
    dp_subscriber_base[/"Абонентская база v2.3.0"/]
  end
  subgraph dom_technical["Технический домен"]
    sys_eva["EVA"]
    sys_gitlab["GitLab"]
  end
  subgraph dom_commercial["Коммерческий домен"]
    sys_bi["Коммерческая аналитика"]
    emp_analyst(("Мария — аналитик"))
  end
  sys_eva -- "stream" --> sys_data_platform
  sys_data_platform -- "sql" --> sys_product_warehouse
  sys_product_warehouse -- "sql" --> sys_istok
  sys_istok -- "sql" --> sys_bi
  sys_gitlab -- "api" --> sys_data_platform
  sys_metadata -- "mcp" --> sys_istok
  emp_product_owner -. "owns" .-> dp_subscriber_base
  emp_data_engineer -. "worksWith" .-> sys_data_platform
  emp_analyst -. "worksWith" .-> sys_bi
  sys_metadata -. "describes" .-> dp_subscriber_base
  emp_data_engineer -. "передаёт контекст релиза" .-> emp_product_owner
  emp_analyst -. "запросы на изменения" .-> emp_product_owner
  dp_subscriber_base == "Контракт: Абонентская база → Аналитика" ==> sys_bi
```

## Процесс: Поставка продукта «Абонентская база»

```mermaid
sequenceDiagram
  title Поставка продукта «Абонентская база»
  participant sys_eva as EVA
  participant sys_data_platform as Data Platform
  participant sys_product_warehouse as Склад продуктов данных
  participant emp_product_owner as Игорь — владелец продукта
  participant sys_istok as ИСТОК
  participant sys_bi as Коммерческая аналитика
  sys_eva->>sys_data_platform: Выгрузка изменений (CDC)
  Note over sys_data_platform: Сборка продукта (dbt + Dagster)
  sys_data_platform->>sys_product_warehouse: Проверки качества 42/42 (Абонентская база)
  sys_product_warehouse->>emp_product_owner: Публикация версии на склад (Абонентская база)
  emp_product_owner->>sys_istok: Ручное согласование публикации
  sys_istok->>sys_bi: Проверка контракта и прав (Абонентская база)
  Note over sys_bi: Доставка потребителю
```

