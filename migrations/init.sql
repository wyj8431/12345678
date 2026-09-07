CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  title VARCHAR(255),
  summary TEXT,
  status ENUM('active', 'archived', 'deleted') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_conversations_user_id (user_id),
  INDEX idx_conversations_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  conversation_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role ENUM('user', 'assistant', 'system') NOT NULL,
  content MEDIUMTEXT NOT NULL,
  input_type ENUM('text', 'audio', 'file', 'image') NOT NULL DEFAULT 'text',
  model_provider VARCHAR(32),
  rag_used BOOLEAN NOT NULL DEFAULT FALSE,
  safety_status ENUM('passed', 'blocked', 'review_required') NOT NULL DEFAULT 'passed',
  latency_ms INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_messages_conversation_id (conversation_id),
  INDEX idx_messages_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS knowledge_files (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type ENUM('pdf', 'word', 'excel', 'txt', 'image', 'audio') NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path VARCHAR(512) NOT NULL,
  ingest_mode ENUM('temporary', 'permanent') NOT NULL DEFAULT 'permanent',
  status ENUM('uploaded', 'processing', 'ready', 'failed', 'deleted') NOT NULL DEFAULT 'uploaded',
  checksum VARCHAR(128) NOT NULL,
  chunk_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_files_user_status (user_id, status),
  INDEX idx_files_checksum (checksum)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ingest_tasks (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  file_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  task_type ENUM('file', 'image', 'audio', 'delete_chroma_vectors') NOT NULL,
  status ENUM('pending', 'parsing', 'cleaning', 'chunking', 'embedding', 'upserting', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  progress TINYINT NOT NULL DEFAULT 0,
  error_code VARCHAR(64),
  error_message VARCHAR(512),
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tasks_user_status (user_id, status),
  INDEX idx_tasks_file_id (file_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS message_references (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  message_id BIGINT NOT NULL,
  file_id BIGINT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  page_number INT,
  chunk_index INT NOT NULL,
  score DECIMAL(5, 4) NOT NULL,
  quote_preview VARCHAR(512),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_refs_message_id (message_id),
  INDEX idx_refs_file_id (file_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS feedback (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  message_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  rating ENUM('up', 'down') NOT NULL,
  reason ENUM('answer_irrelevant', 'wrong_citation', 'incomplete', 'hallucination', 'other'),
  comment VARCHAR(512),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_feedback_message_id (message_id),
  INDEX idx_feedback_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS model_call_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT,
  conversation_id BIGINT,
  provider VARCHAR(32) NOT NULL,
  purpose ENUM('chat', 'rewrite_query', 'summarize', 'embedding', 'safety') NOT NULL,
  status ENUM('success', 'failed', 'timeout', 'aborted') NOT NULL,
  latency_ms INT,
  token_input INT,
  token_output INT,
  error_code VARCHAR(64),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_model_logs_user_created (user_id, created_at),
  INDEX idx_model_logs_provider_status (provider, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rag_query_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  conversation_id BIGINT,
  message_id BIGINT,
  query TEXT NOT NULL,
  rewritten_query TEXT,
  top_k INT NOT NULL,
  threshold_value DECIMAL(5, 4) NOT NULL,
  hit_count INT NOT NULL DEFAULT 0,
  max_score DECIMAL(5, 4),
  used_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  latency_ms INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rag_logs_user_created (user_id, created_at),
  INDEX idx_rag_logs_fallback_created (used_fallback, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT,
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(64),
  target_id BIGINT,
  risk_level ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'low',
  status ENUM('success', 'blocked', 'failed') NOT NULL,
  error_code VARCHAR(64),
  ip VARCHAR(64),
  user_agent VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user_created (user_id, created_at),
  INDEX idx_audit_action_created (action, created_at),
  INDEX idx_audit_risk_created (risk_level, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
