import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Leaderboard from '../components/Leaderboard';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export default function Home() {
  const [charId, setCharId] = useState('');
  const [pin, setPin] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [level, setLevel] = useState('');
  const [expVal, setExpVal] = useState('');
  const [file, setFile] = useState(null);
  const [players, setPlayers] = useState([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  async function fetchLeaderboard() {
    if (!supabase) return;
    const { data } = await supabase
      .from('submissions')
      .select('*')
      .order('total_exp', { ascending: false });

    if (data) {
      const latestMap = {};
      data.forEach(sub => {
        if (!latestMap[sub.char_id] || sub.id > latestMap[sub.char_id].id) {
          latestMap[sub.char_id] = sub;
        }
      });
      const list = Object.values(latestMap).sort((a, b) => b.total_exp - a.total_exp);
      setPlayers(list);
    }
  }

  async function handleAuth(e) {
    e.preventDefault();
    if (!supabase) return setMsg('Supabase 設定未完全');
    if (!charId || !pin) return setMsg('請輸入角色名稱與 PIN 碼');

    const { data: user } = await supabase
      .from('participants')
      .select('*')
      .eq('char_id', charId)
      .single();

    if (!user) {
      const { error } = await supabase.from('participants').insert([{ char_id: charId, pin }]);
      if (error) return setMsg('註冊失敗：' + error.message);
      setMsg('註冊成功並登入！');
      setIsLoggedIn(true);
    } else {
      if (user.pin !== pin) {
        return setMsg('PIN 碼不正確！');
      }
      setMsg('登入成功！');
      setIsLoggedIn(true);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return setMsg('請選擇截圖照片');
    setLoading(true);
    setMsg('照片上傳中...');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${charId}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('screenshots')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('screenshots')
        .getPublicUrl(fileName);

      const photoUrl = publicUrlData.publicUrl;
      const totalExp = Number(level) * 10000000 + Number(expVal);

      const { error: subError } = await supabase.from('submissions').insert([{
        char_id: charId,
        level: Number(level),
        exp_val: Number(expVal),
        total_exp: totalExp,
        photo_url: photoUrl,
        status: 'approved'
      }]);

      if (subError) throw subError;

      setMsg('成績已成功提交！');
      fetchLeaderboard();
    } catch (err) {
      setMsg('上傳失敗：' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#1e293b' }}>🍁 Artale 夏日練等大賽</h1>

      {msg && <div style={{ background: '#3b82f6', color: '#fff', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>{msg}</div>}

      {!isLoggedIn ? (
        <form onSubmit={handleAuth} style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
          <h3>🔑 玩家登入 / 報名</h3>
          <input type="text" placeholder="遊戲角色 ID" value={charId} onChange={e => setCharId(e.target.value)} style={{ display: 'block', margin: '10px 0', padding: '8px', width: '100%' }} />
          <input type="password" placeholder="自訂 PIN 碼" value={pin} onChange={e => setPin(e.target.value)} style={{ display: 'block', margin: '10px 0', padding: '8px', width: '100%' }} />
          <button type="submit" style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>登入 / 註冊</button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
          <h3>📸 回報等級與截圖 ({charId})</h3>
          <input type="number" placeholder="當前等級 (Lv)" value={level} onChange={e => setLevel(e.target.value)} style={{ display: 'block', margin: '10px 0', padding: '8px', width: '100%' }} />
          <input type="number" placeholder="經驗值數字 (EXP)" value={expVal} onChange={e => setExpVal(e.target.value)} style={{ display: 'block', margin: '10px 0', padding: '8px', width: '100%' }} />
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} style={{ display: 'block', margin: '10px 0' }} />
          <button type="submit" disabled={loading} style={{ padding: '10px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>{loading ? '上傳中...' : '提交成績'}</button>
        </form>
      )}

      <Leaderboard players={players} />
    </div>
  );
}
