# Модель предприятия — Mermaid

> Сгенерировано из `src/data/enterprise.json` командой `npm run export:mermaid`. Не редактировать вручную.

## Связи систем

```mermaid
flowchart LR
  subgraph dom_data["Data Platform"]
    sys_traefik["Traefik"]
    sys_trino["Trino"]
    sys_dagster["Dagster"]
    sys_ceph["Ceph RGW"]
    sys_nessie["Nessie"]
    sys_dlt["dlt-пайплайны"]
    sys_jupyter["JupyterHub"]
    sys_infisical["Infisical"]
    sys_observability["Наблюдаемость"]
    sys_metadata["OpenMetadata"]
    sys_cube["Cube.dev"]
    sys_istok["ИСТОК"]
    layer_landing[("Landing · iceberg_landing")]
    layer_bronze[("Bronze · iceberg / iceberg_dev")]
    layer_silver[("Silver · iceberg / iceberg_dev")]
    layer_gold[("Gold · iceberg")]
    layer_sandbox[("Sandbox · iceberg_sandbox")]
    emp_data_engineer(("Анна — инженер данных"))
    emp_product_owner(("Игорь — владелец продукта"))
    dp_stg_eva_transitions[/"stg_eva__transitions"/]
    dp_landing_extapi_requests[/"extapi_requests"/]
    dp_stg_extapi_requests[/"stg_extapi__requests"/]
  end
  subgraph dom_technical["Источники и инженерия"]
    sys_eva["EVA"]
    sys_extapi["Внешний API"]
    sys_gitlab["GitLab"]
  end
  subgraph dom_corpgov["Корпоративное управление"]
    sys_bi["Отчётность"]
    emp_analyst(("Мария — аналитик"))
    dp_corpgov_dim_transition[/"corpgov_dim__transition"/]
    dp_corpgov_exp_transitions[/"corpgov_exp__transitions"/]
    dp_corpgov_fct_request[/"corpgov_fct__request"/]
  end
  sys_eva --> dp_stg_eva_transitions
  dp_stg_eva_transitions --> dp_corpgov_dim_transition
  dp_corpgov_dim_transition --> dp_corpgov_exp_transitions
  sys_extapi --> dp_landing_extapi_requests
  dp_landing_extapi_requests --> dp_stg_extapi_requests
  dp_stg_extapi_requests --> dp_corpgov_fct_request
  sys_eva -- "sql" --> sys_trino
  sys_extapi -- "api" --> sys_dlt
  sys_dlt -- "file" --> sys_ceph
  sys_trino -- "file" --> sys_ceph
  sys_trino -- "api" --> sys_nessie
  sys_dagster -- "sql" --> sys_trino
  sys_dagster -- "api" --> sys_dlt
  sys_gitlab -- "api" --> sys_dagster
  sys_traefik -- "ui" --> sys_dagster
  sys_traefik -- "ui" --> sys_jupyter
  sys_jupyter -- "sql" --> sys_trino
  sys_dagster -- "api" --> sys_infisical
  sys_trino -- "stream" --> sys_observability
  sys_dagster -- "stream" --> sys_observability
  sys_trino -- "sql" --> sys_cube
  sys_cube -- "api" --> sys_istok
  sys_istok -- "sql" --> sys_bi
  sys_metadata -- "api" --> sys_trino
  sys_metadata -- "mcp" --> sys_istok
  emp_product_owner -. "owns" .-> dp_corpgov_exp_transitions
  emp_data_engineer -. "worksWith" .-> sys_dagster
  emp_analyst -. "worksWith" .-> sys_bi
  sys_metadata -. "describes" .-> dp_corpgov_exp_transitions
  emp_data_engineer -. "MR на ревью" .-> emp_product_owner
  emp_analyst -. "запросы на изменения витрины" .-> emp_product_owner
  emp_data_engineer -. "робот-нода в сэндбоксе" .-> layer_sandbox
  dp_corpgov_exp_transitions == "Контракт: Витрина переходов → Отчётность" ==> sys_bi
```

## Процесс: Pattern A · витрина из EVA

```mermaid
sequenceDiagram
  title Pattern A · витрина из EVA
  participant sys_eva as EVA
  participant layer_bronze as Bronze
  participant layer_silver as Silver
  participant layer_gold as Gold
  participant sys_cube as Cube.dev
  participant sys_istok as ИСТОК
  participant sys_bi as Отчётность
  sys_eva->>layer_bronze: Источник подключён Trino-каталогом
  layer_bronze->>layer_silver: stg_eva__transitions: dedup, type cast (Переходы EVA (staging))
  layer_silver->>layer_gold: corpgov_dim__transition: ключи, SCD2 (Измерение «Переход»)
  layer_gold->>sys_cube: corpgov_exp__transitions → merge в main (CI) (Витрина переходов)
  sys_cube->>sys_istok: Cube.dev: погрузка в грузовик (Витрина переходов)
  sys_istok->>sys_bi: Проверка контракта и прав (Витрина переходов)
  Note over sys_bi: Доставка в отчётность
```

## Процесс: Pattern B · загрузка через dlt

```mermaid
sequenceDiagram
  title Pattern B · загрузка через dlt
  participant sys_extapi as Внешний API
  participant sys_dlt as dlt-пайплайны
  participant layer_landing as Landing
  participant layer_bronze as Bronze
  participant layer_silver as Silver
  sys_extapi->>sys_dlt: Выдача данных по API
  sys_dlt->>layer_landing: dlt-пайплайн по расписанию
  layer_landing->>layer_bronze: Разгрузка на склад Landing as-is (Заявки из внешнего API (сырые))
  layer_bronze->>layer_silver: stg_extapi__requests (Заявки (staging))
  Note over layer_silver: corpgov_fct__request
```

## Процесс: Изменение модели: Git → Nessie → релиз

```mermaid
sequenceDiagram
  title Изменение модели: Git → Nessie → релиз
  participant emp_data_engineer as Анна — инженер данных
  participant sys_gitlab as GitLab
  participant emp_product_owner as Игорь — владелец продукта
  participant sys_nessie as Nessie
  participant sys_dagster as Dagster
  emp_data_engineer->>sys_gitlab: Правка в личной ветке, локальные слои
  sys_gitlab->>emp_product_owner: MR в dp-transform
  emp_product_owner->>sys_gitlab: Ревью MR
  sys_gitlab->>sys_nessie: CI: тесты, проверка имён, образ
  sys_nessie->>sys_gitlab: Пересборка в своей ref на ленте → merge в main
  sys_gitlab->>sys_dagster: Тег образа и release manifest
  sys_dagster->>emp_product_owner: Выкладка образа в Dagster
  Note over emp_product_owner: Сообщение потребителям в dp-changelog ✋
```

