-- ページトラッカー用のSupabaseスキーマ
-- ページベースの日次トラッキング機能

-- 1. 登録ページテーブル
CREATE TABLE IF NOT EXISTS page_tracker_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  site_url TEXT NOT NULL,
  page_url TEXT NOT NULL,
  page_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, site_url, page_url)
);

-- 2. 日次データテーブル
CREATE TABLE IF NOT EXISTS page_tracker_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES page_tracker_pages(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr FLOAT DEFAULT 0,
  position FLOAT DEFAULT 0,
  top_queries JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(page_id, date)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_page_tracker_pages_user_site ON page_tracker_pages(user_id, site_url);
CREATE INDEX IF NOT EXISTS idx_page_tracker_pages_page_url ON page_tracker_pages(page_url);
CREATE INDEX IF NOT EXISTS idx_page_tracker_daily_page_date ON page_tracker_daily(page_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_page_tracker_daily_date ON page_tracker_daily(date DESC);

-- RLS (Row Level Security) を有効化（オプション）
ALTER TABLE page_tracker_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_tracker_daily ENABLE ROW LEVEL SECURITY;

-- 全てのユーザーが自分のデータにアクセス可能（認証を使う場合）
-- CREATE POLICY "Users can view their own pages" ON page_tracker_pages FOR SELECT USING (auth.uid()::text = user_id);
-- CREATE POLICY "Users can insert their own pages" ON page_tracker_pages FOR INSERT WITH CHECK (auth.uid()::text = user_id);
-- CREATE POLICY "Users can update their own pages" ON page_tracker_pages FOR UPDATE USING (auth.uid()::text = user_id);
-- CREATE POLICY "Users can delete their own pages" ON page_tracker_pages FOR DELETE USING (auth.uid()::text = user_id);

-- 簡易版: 全てのユーザーがアクセス可能（Basic認証を使用している場合）
CREATE POLICY "Anyone can access page_tracker_pages" ON page_tracker_pages FOR ALL USING (true);
CREATE POLICY "Anyone can access page_tracker_daily" ON page_tracker_daily FOR ALL USING (true);

-- コメント追加
COMMENT ON TABLE page_tracker_pages IS 'ページトラッカーで登録されたページ一覧';
COMMENT ON TABLE page_tracker_daily IS 'ページごとの日次パフォーマンスデータ';
COMMENT ON COLUMN page_tracker_daily.top_queries IS 'その日のトップクエリ（JSON配列: [{query, clicks, position}]）';
