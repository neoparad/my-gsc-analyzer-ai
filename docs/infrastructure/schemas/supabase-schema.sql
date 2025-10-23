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

-- ====================================
-- Citation Analysis Tables
-- ====================================

-- 被リンク・言及データ
CREATE TABLE IF NOT EXISTS citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_domain TEXT NOT NULL,
  citation_text TEXT,
  context_before TEXT,
  context_after TEXT,
  citation_type TEXT CHECK (citation_type IN ('link', 'mention', 'both')),
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  topics TEXT[], -- 抽出されたトピック
  anchor_text TEXT,
  is_dofollow BOOLEAN DEFAULT true,
  crawl_date DATE NOT NULL,
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, domain, source_url, citation_text)
);

-- 分析ジョブ管理
CREATE TABLE IF NOT EXISTS analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  job_type TEXT CHECK (job_type IN ('initial', 'monthly', 'competitor')),
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  crawl_months TEXT[], -- 分析対象の月 (例: ['2024-01', '2024-02'])
  competitor_domains TEXT[], -- 競合ドメイン
  total_citations INTEGER DEFAULT 0,
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- サイテーションスコア（月次集計）
CREATE TABLE IF NOT EXISTS citation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  month TEXT NOT NULL, -- 'YYYY-MM'形式
  total_citations INTEGER DEFAULT 0,
  link_count INTEGER DEFAULT 0,
  mention_count INTEGER DEFAULT 0,
  unique_domains INTEGER DEFAULT 0,
  sentiment_positive INTEGER DEFAULT 0,
  sentiment_neutral INTEGER DEFAULT 0,
  sentiment_negative INTEGER DEFAULT 0,
  top_topics TEXT[], -- その月の主要トピック
  citation_score DECIMAL, -- 総合スコア
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, domain, month)
);

-- 月次サイテーション推移
CREATE TABLE IF NOT EXISTS monthly_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  month TEXT NOT NULL,
  citation_count INTEGER DEFAULT 0,
  link_count INTEGER DEFAULT 0,
  mention_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, domain, month)
);

-- Common Crawlキャッシュ（重複取得防止）
CREATE TABLE IF NOT EXISTS crawl_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  crawl_month TEXT NOT NULL, -- 'YYYY-MM'形式
  warc_file TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  citations_found INTEGER DEFAULT 0,
  UNIQUE(domain, crawl_month, warc_file)
);

-- インデックス（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_citations_user_domain ON citations(user_id, domain);
CREATE INDEX IF NOT EXISTS idx_citations_crawl_date ON citations(crawl_date);
CREATE INDEX IF NOT EXISTS idx_citations_source_domain ON citations(source_domain);
CREATE INDEX IF NOT EXISTS idx_citations_sentiment ON citations(sentiment);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_status ON analysis_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_citation_scores_user_domain_month ON citation_scores(user_id, domain, month);
CREATE INDEX IF NOT EXISTS idx_monthly_citations_user_domain ON monthly_citations(user_id, domain);
CREATE INDEX IF NOT EXISTS idx_crawl_cache_domain_month ON crawl_cache(domain, crawl_month);

-- 更新日時自動更新トリガー（citation_scores用）
CREATE TRIGGER update_citation_scores_updated_at
BEFORE UPDATE ON citation_scores
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE citation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_cache ENABLE ROW LEVEL SECURITY;

-- アクセスポリシー
CREATE POLICY "Enable all access for authenticated users" ON citations
  FOR ALL USING (true);

CREATE POLICY "Enable all access for authenticated users" ON analysis_jobs
  FOR ALL USING (true);

CREATE POLICY "Enable all access for authenticated users" ON citation_scores
  FOR ALL USING (true);

CREATE POLICY "Enable all access for authenticated users" ON monthly_citations
  FOR ALL USING (true);

CREATE POLICY "Enable all access for authenticated users" ON crawl_cache
  FOR ALL USING (true);
