CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS hierarchy_department_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hierarchy_role_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO hierarchy_department_catalog (name, is_system)
VALUES
    ('Отдел внутреннего аудита', true),
    ('Архитектурно-проектный отдел', true),
    ('Отдел дизайнеров', true),
    ('ПТО', true),
    ('Руководители строительных участков', true),
    ('IT-отдел', true),
    ('Отдел кадров (HR)', true),
    ('Юридический отдел', true),
    ('Коммерческий отдел / Отдел продаж', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO hierarchy_role_catalog (name, is_system)
VALUES
    ('Генеральный директор', true),
    ('Технический директор (главный инженер)', true),
    ('Директор по строительству', true),
    ('Внутренний аудитор', true),
    ('Главный архитектор', true),
    ('Архитектор', true),
    ('Руководитель отдела дизайнеров', true),
    ('Дизайнер интерьера', true),
    ('Дизайнер экстерьера', true),
    ('Начальник ПТО', true),
    ('Инженер ПТО', true),
    ('Руководитель группы прорабов', true),
    ('Прораб', true),
    ('Руководитель IT-отдела', true),
    ('Frontend-разработчик', true),
    ('Backend-разработчик', true),
    ('IT-поддержка', true),
    ('Руководитель HR-отдела', true),
    ('HR-специалист', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO hierarchy_department_catalog (name, is_system)
SELECT DISTINCT BTRIM(n.title), false
FROM hierarchy_nodes n
WHERE n.type = 'department'
  AND BTRIM(COALESCE(n.title, '')) <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO hierarchy_role_catalog (name, is_system)
SELECT DISTINCT BTRIM(n.role_title), false
FROM hierarchy_nodes n
WHERE BTRIM(COALESCE(n.role_title, '')) <> ''
ON CONFLICT (name) DO NOTHING;
