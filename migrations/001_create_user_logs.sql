CREATE TABLE IF NOT EXISTS user_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  event_name TEXT NOT NULL,
  source TEXT NOT NULL,
  path TEXT,
  session_id TEXT,
  app_version TEXT,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_logs_created_at ON user_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_logs_event_name ON user_logs(event_name);
CREATE INDEX IF NOT EXISTS idx_user_logs_source ON user_logs(source);
CREATE INDEX IF NOT EXISTS idx_user_logs_session_id ON user_logs(session_id);
