DROP INDEX IF EXISTS idx_chat_presence_last_seen;
DROP INDEX IF EXISTS idx_chat_threads_updated;
DROP INDEX IF EXISTS idx_chat_messages_thread_created;
DROP INDEX IF EXISTS idx_chat_thread_members_user;

DROP TABLE IF EXISTS chat_user_presence;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_direct_threads;
DROP TABLE IF EXISTS chat_thread_members;
DROP TABLE IF EXISTS chat_threads;
