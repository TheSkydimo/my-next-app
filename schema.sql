CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  is_super_admin INTEGER NOT NULL DEFAULT 0,
  -- 会员到期时间（为空或早于当前时间视为非会员）
  vip_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_verification_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户反馈表：用户可在前台提交反馈，管理员在后台查看并标记已读
CREATE TABLE IF NOT EXISTS user_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP,
  latest_reply_at TIMESTAMP,
  latest_reply_admin_id INTEGER,
  closed_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_user ON user_feedback (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_status ON user_feedback (status, created_at DESC);

-- 管理员回复记录表：用于记录每一次站内回复
CREATE TABLE IF NOT EXISTS user_feedback_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feedback_id INTEGER NOT NULL,
  admin_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (feedback_id) REFERENCES user_feedback(id),
  FOREIGN KEY (admin_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_replies_feedback ON user_feedback_replies (feedback_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_replies_admin ON user_feedback_replies (admin_id, created_at DESC);

-- 用户脚本分享：用户上传脚本文件到 R2，生成随机唯一 ID，供其他用户查看/下载。
CREATE TABLE IF NOT EXISTS script_shares (
  id TEXT PRIMARY KEY,
  owner_user_id INTEGER NOT NULL,
  effect_name TEXT NOT NULL,
  public_username TEXT NOT NULL,
  -- 语言环境：zh-CN / en-US。不同语言环境下只展示对应脚本。
  lang TEXT NOT NULL DEFAULT 'zh-CN',
  -- 是否公开：1=公开（所有用户可查看/下载），0=私密（仅作者/管理员可查看/下载）
  is_public INTEGER NOT NULL DEFAULT 1,
  r2_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_script_shares_owner_created ON script_shares (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_script_shares_created ON script_shares (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_script_shares_lang_created ON script_shares (lang, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_script_shares_owner_lang_created ON script_shares (owner_user_id, lang, created_at DESC);