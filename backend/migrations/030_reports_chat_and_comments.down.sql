DROP INDEX IF EXISTS idx_delay_report_comments_project_id;
DROP INDEX IF EXISTS idx_delay_report_comments_parent_id;
DROP INDEX IF EXISTS idx_delay_report_comments_report_created_at;
DROP TABLE IF EXISTS delay_report_comments;

DROP INDEX IF EXISTS idx_report_chat_messages_task_id_created_at;
DROP INDEX IF EXISTS idx_report_chat_messages_project_id_created_at;
DROP TABLE IF EXISTS report_chat_messages;
