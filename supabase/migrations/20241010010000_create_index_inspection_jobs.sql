-- インデックス検査ジョブ管理テーブル
CREATE TABLE IF NOT EXISTS index_inspection_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'running', -- running, completed, failed
  total_urls INTEGER NOT NULL,
  completed_urls INTEGER NOT NULL DEFAULT 0,
  results JSONB DEFAULT '[]'::jsonb,
  error TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_index_inspection_jobs_job_id ON index_inspection_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_index_inspection_jobs_status ON index_inspection_jobs(status);
CREATE INDEX IF NOT EXISTS idx_index_inspection_jobs_created_at ON index_inspection_jobs(created_at);

-- 更新日時を自動更新するトリガー
CREATE TRIGGER update_index_inspection_jobs_updated_at
BEFORE UPDATE ON index_inspection_jobs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE index_inspection_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON index_inspection_jobs
  FOR ALL USING (true);
