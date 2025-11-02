-- 週単位のサイコロ履歴テーブル
CREATE TABLE IF NOT EXISTS user_dice_weekly (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  week INTEGER NOT NULL,
  dice1 INTEGER NOT NULL,
  dice2 INTEGER NOT NULL,
  dice_score INTEGER NOT NULL,
  is_doubles INTEGER DEFAULT 0,
  used_ticket INTEGER DEFAULT 0,
  total_score INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, year, week)
);

CREATE INDEX IF NOT EXISTS idx_user_dice_weekly_user_year_week ON user_dice_weekly(user_id, year, week);
