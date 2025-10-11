// Supabaseテーブル存在確認スクリプト
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://ekzeytltaiiknvlbqhbn.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVremV5dGx0YWlpa252bGJxaGJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc4NTY5MDIsImV4cCI6MjA0MzQzMjkwMn0.i2vvV8XJlrAITbT4rHK3nQw6eZEvUZZpZeFP7bIDI5Q';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
  console.log('Checking if index_inspection_jobs table exists...\n');

  try {
    // テーブルから1行取得を試みる
    const { data, error } = await supabase
      .from('index_inspection_jobs')
      .select('*')
      .limit(1);

    if (error) {
      if (error.code === '42P01') {
        console.log('❌ テーブルが存在しません');
        console.log('エラー:', error.message);
        console.log('\nテーブルを作成する必要があります。');
        return false;
      }
      console.log('⚠️ エラーが発生しました:', error);
      return false;
    }

    console.log('✅ テーブルは存在します！');
    console.log('レコード数:', data ? data.length : 0);
    if (data && data.length > 0) {
      console.log('サンプルデータ:', JSON.stringify(data[0], null, 2));
    }
    return true;

  } catch (err) {
    console.error('予期しないエラー:', err);
    return false;
  }
}

checkTable().then(exists => {
  process.exit(exists ? 0 : 1);
});
