-- ランクトラッカーのクエリ保存用テーブル
CREATE TABLE IF NOT EXISTS rank_tracker_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,  -- ユーザー名（AuthContextから取得）
  site_url TEXT NOT NULL,
  query TEXT NOT NULL,
  top_page_url TEXT,
  page_title TEXT,
  current_position DECIMAL,
  latest_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, query, site_url)  -- 同じユーザーが同じクエリを重複登録できないようにする
);

-- 順位履歴データ用テーブル
CREATE TABLE IF NOT EXISTS rank_tracker_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID REFERENCES rank_tracker_queries(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  position DECIMAL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(query_id, date)  -- 同じクエリの同じ日付のデータは重複しない
);

-- インデックス（パフォーマンス向上のため）
CREATE INDEX IF NOT EXISTS idx_rank_tracker_queries_user_id ON rank_tracker_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_rank_tracker_queries_site_url ON rank_tracker_queries(site_url);
CREATE INDEX IF NOT EXISTS idx_rank_tracker_history_query_id ON rank_tracker_history(query_id);
CREATE INDEX IF NOT EXISTS idx_rank_tracker_history_date ON rank_tracker_history(date);

-- 更新日時を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rank_tracker_queries_updated_at
BEFORE UPDATE ON rank_tracker_queries
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) の設定
-- ユーザーは自分のデータのみアクセス可能
ALTER TABLE rank_tracker_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_tracker_history ENABLE ROW LEVEL SECURITY;

-- 匿名アクセスを許可するポリシー（API経由でのアクセス用）
-- 本番環境では、より厳密な認証を実装することを推奨
CREATE POLICY "Enable all access for authenticated users" ON rank_tracker_queries
  FOR ALL USING (true);

CREATE POLICY "Enable all access for authenticated users" ON rank_tracker_history
  FOR ALL USING (true);
