import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// 🍁 Artale 經驗值對照與 120等後 1.05 倍成長公式
function getExpRequiredForLevel(lv) {
  if (lv <= 1) return 15;
  if (lv <= 15) return Math.floor(15 * Math.pow(1.3, lv - 1));
  if (lv <= 30) return Math.floor(1000 * Math.pow(1.2, lv - 15));
  if (lv <= 70) return Math.floor(15000 * Math.pow(1.15, lv - 30));
  if (lv <= 120) return Math.floor(200000 * Math.pow(1.1, lv - 70));
  if (lv <= 200) {
    const baseExp120 = 3000000; 
    return Math.floor(baseExp120 * Math.pow(1.05, lv - 121));
  }
  return 1000000000;
}

function getCumulativeExp(lv) {
  let total = 0;
  for (let i = 1; i < lv; i++) {
    total += getExpRequiredForLevel(i);
  }
  return total;
}

// 🎁 指定名次獎勵標籤
function getPrizeBadge(rank) {
  if (rank === 0) return '🥇 第一名／闇黑龍王披風一件（美國阿翔贊助）';
  if (rank === 1) return '🥈 第二名／楓葉祝福２０一本（美國阿翔贊助）';
  if (rank === 2) return '🥉 第三名／闇黑龍王項鍊一條（美國阿翔贊助）';
  if (rank === 3) return '🏅 第四名／雪花 300';
  if (rank === 4) return '🏅 第五名／突襲劵 14 張（夏日活動贊助商贊助）';
  if (rank >= 5 && rank <= 13) return '🏅 第六~十四名／突襲劵 7 張（夏日活動贊助商贊助）';
  if (rank === 14) return '🏅 第十五名／本人堅持送商城寵物一隻';
  if (rank >= 15 && rank <= 19) return '🏅 第十六~二十名／雪花 50';
  return '🎗️ 努力參賽獎';
}

export default function Home() {
  const [charId, setCharId] = useState('');
  const [pin, setPin] = useState('');
  const [loggedInUser, setLoggedInUser] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  
  const [level, setLevel] = useState('');
  const [expVal, setExpVal] = useState('');
  const [file, setFile] = useState(null);
  
  const [players, setPlayers] = useState([]);
  const [history, setHistory] = useState([]);
  const [msg, setMsg] = useState('');
  const [charNotice, setCharNotice] = useState('');
  const [isManualEdited, setIsManualEdited] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  // ⏳ 活動倒數計時器狀態 (截止時間：2026/09/08 07:59)
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, isEnded: false });

  useEffect(() => {
    const targetDate = new Date('2026-09-08T07:59:00+08:00');
    const timer = setInterval(() => {
      const now = new Date();
      const diff = targetDate - now;
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isEnded: true });
        clearInterval(timer);
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeft({ days, hours, minutes, seconds, isEnded: false });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('artale_user');
    if (savedUser) {
      setLoggedInUser(savedUser);
      setIsLoggedIn(true);
      fetchUserHistory(savedUser);
      fetchLeaderboard();
    }
  }, []);

  async function fetchLeaderboard() {
    if (!supabase) return;
    const { data } = await supabase
      .from('submissions')
      .select('*')
      .order('id', { ascending: true });

    if (data && data.length > 0) {
      const userGroup = {};
      data.forEach(sub => {
        const cleanName = (sub.char_id || '').trim();
        if (!cleanName) return;
        if (!userGroup[cleanName]) {
          userGroup[cleanName] = [];
        }
        userGroup[cleanName].push(sub);
      });

      const list = Object.keys(userGroup).map(id => {
        const subs = userGroup[id];
        const baseline = subs[0];
        const latest = subs[subs.length - 1];

        const baselineTotal = Number(baseline.total_exp) || 0;
        const latestTotal = Number(latest.total_exp) || 0;
        const expGrowth = latestTotal - baselineTotal;

        return {
          char_id: id,
          level: latest.level,
          exp_val: latest.exp_val,
          growth_exp: expGrowth >= 0 ? expGrowth : 0,
          created_at: latest.created_at,
          submission_count: subs.length
        };
      });

      list.sort((a, b) => b.growth_exp - a.growth_exp);
      setPlayers(list);
    }
  }

  async function fetchUserHistory(id) {
    if (!supabase) return;
    const cleanId = id.trim();
    const { data } = await supabase
      .from('submissions')
      .select('*')
      .eq('char_id', cleanId)
      .order('id', { ascending: true });

    if (data && data.length > 0) {
      setHistory(data);
      setHasSubmitted(true);
    }
  }

  async function handleAuth(e) {
    e.preventDefault();
    const cleanId = charId.trim();
    if (!supabase) return setMsg('網頁整理中，請稍後...');
    if (!cleanId || !pin) return setMsg('請輸入遊戲角色 ID 與 4 位數 PIN 碼');
    if (pin.length !== 4) return setMsg('PIN 碼必須是 4 位數字');

    const { data: user } = await supabase
      .from('participants')
      .select('*')
      .eq('char_id', cleanId)
      .single();

    if (!user) {
      const { error } = await supabase.from('participants').insert([{ char_id: cleanId, pin }]);
      if (error) return setMsg('註冊失敗：' + error.message);
      setMsg('註冊成功並自動登入！');
      setLoggedInUser(cleanId);
      localStorage.setItem('artale_user', cleanId);
      setIsLoggedIn(true);
      fetchUserHistory(cleanId);
      fetchLeaderboard();
    } else {
      if (user.pin !== pin) {
        return setMsg('PIN 碼不正確！');
      }
      setMsg('登入成功！');
      setLoggedInUser(cleanId);
      localStorage.setItem('artale_user', cleanId);
      setIsLoggedIn(true);
      fetchUserHistory(cleanId);
      fetchLeaderboard();
    }
  }

  function handleLogout() {
    localStorage.removeItem('artale_user');
    setIsLoggedIn(false);
    setLoggedInUser('');
    setCharId('');
    setPin('');
    setHasSubmitted(false);
    setHistory([]);
    setMsg('已成功登出！');
  }

  function prepareImageForOCR(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 2000;
          let width = img.width;
          let height = img.height;
          if (width > height && width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          } else if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // 📸 升級版 OCR 智慧辨識 (精準過濾介面干擾)
  async function handleFileChange(e) {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setScanning(true);
    setCharNotice('');
    setIsManualEdited(false);
    setMsg('🔍 正在智慧辨識遊戲截圖...');

    try {
      const ocrImage = await prepareImageForOCR(selectedFile);

      if (window.Tesseract) {
        const result = await window.Tesseract.recognize(ocrImage, 'eng');
        const text = result.data.text;

        // 1. 精準抓取等級 (LV) - 支援 LV. 179 或 LV179 格式
        const lvMatch = text.match(/LV[\s\.:]*(\d{1,3})/i);
        if (lvMatch && lvMatch[1]) {
          setLevel(lvMatch[1]);
        }

        // 2. 精準抓取經驗值 (EXP) - 排除括號百分比，只抓取純數字
        const expRegex = /EXP[\s\.:]*([0-9,]+)/i;
        const expMatch = text.match(expRegex);
        if (expMatch && expMatch[1]) {
          const cleanExp = expMatch[1].replace(/,/g, '');
          setExpVal(cleanExp);
        }

        // 3. 智慧核對目前登入的遊戲 ID
        if (loggedInUser) {
          const cleanText = text.replace(/\s+/g, '').toLowerCase();
          const cleanUser = loggedInUser.trim().toLowerCase();
          if (cleanText.includes(cleanUser)) {
            setCharNotice(`✅ 成功在截圖中確認角色 ID：${loggedInUser}`);
          } else {
            setCharNotice(`⚠️ 提示：截圖中未自動完全對應到角色 ID（${loggedInUser}）。若數值有誤請手動修改，送出後將由管理員審核。`);
            setIsManualEdited(true);
          }
        }

        setMsg('✨ 智慧辨識完成！請核對下方數值，如有誤差可直接修改。');
      }
    } catch (err) {
      setMsg('圖片讀取完成，請手動確認等級與經驗值。');
    } finally {
      setScanning(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return setMsg('請選擇截圖照片');
    if (!level || !expVal) return setMsg('請填寫或確認等級與經驗值');
    if (!loggedInUser) return setMsg('登入狀態異常，請重新登入');

    setLoading(true);
    setMsg('照片與成績上傳中...');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('screenshots')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('screenshots')
        .getPublicUrl(fileName);

      const photoUrl = publicUrlData.publicUrl;
      const targetLevel = Number(level);
      const inputExpNum = Number(expVal);

      // 自動計算總累積經驗值（包含 120等後 1.05倍遞增）
      const calculatedTotalExp = getCumulativeExp(targetLevel) + inputExpNum;

      const { error: subError } = await supabase.from('submissions').insert([{
        char_id: loggedInUser.trim(),
        level: targetLevel,
        exp_val: inputExpNum,
        total_exp: calculatedTotalExp,
        photo_url: photoUrl,
        is_manual_edited: isManualEdited,
        status: isManualEdited ? 'pending_review' : 'approved'
      }]);

      if (subError) throw subError;

      setMsg('🎉 成績已成功提交！排行榜已為您解鎖並更新。');
      setHasSubmitted(true);
      setIsManualEdited(false);
      fetchLeaderboard();
      fetchUserHistory(loggedInUser);
    } catch (err) {
      setMsg('上傳失敗：' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <Head>
        <title>Artale Idotcat 夏日練等大賽</title>
        <script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
      </Head>

      <h1 style={{ textAlign: 'center', color: '#1e293b', marginBottom: '5px' }}>🍁 Artale Idotcat 夏日練等大賽</h1>
      <p style={{ textAlign: 'center', color: '#64748b', fontSize: '14px', marginTop: '0' }}>
        活動截止：9/8 (二) 7:59 ｜ 截止上傳時間：當天 8:10
      </p>

      {/* ⏳ 倒數計時器 */}
      <div style={{ background: '#1e293b', color: '#fff', padding: '15px', borderRadius: '10px', textAlign: 'center', marginBottom: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '5px' }}>⏳ 距離活動截止倒數</div>
        {timeLeft.isEnded ? (
          <div style={{ fontSize: '18px', color: '#ef4444', fontWeight: 'bold' }}>活動已截止！</div>
        ) : (
          <div style={{ fontSize: '22px', fontWeight: 'bold', letterSpacing: '1px' }}>
            {timeLeft.days} 天 {timeLeft.hours} 小時 {timeLeft.minutes} 分鐘 {timeLeft.seconds} 秒
          </div>
        )}
      </div>

      {msg && <div style={{ background: '#3b82f6', color: '#fff', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontWeight: 'bold', textAlign: 'center' }}>{msg}</div>}

      {!isLoggedIn ? (
        <form onSubmit={handleAuth} style={{ background: '#ffffff', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '30px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3>🔑 玩家登入 / 首次輸入即註冊</h3>
          <p style={{ fontSize: '13px', color: '#64748b' }}>第一次輸入遊戲 ID 與 4 位數密碼即完成註冊，之後請用相同密碼登入。</p>
          <input type="text" placeholder="遊戲角色 ID" value={charId} onChange={e => setCharId(e.target.value)} style={{ display: 'block', margin: '10px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
          <input type="password" maxLength={4} placeholder="自訂 4 位數密碼 (PIN)" value={pin} onChange={e => setPin(e.target.value)} style={{ display: 'block', margin: '10px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
          <button type="submit" style={{ padding: '12px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', width: '100%', fontSize: '16px' }}>登入 / 註冊</button>
        </form>
      ) : (
        <div>
          {/* 回報成績表單 */}
          <form onSubmit={handleSubmit} style={{ background: '#ffffff', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>📸 回報等級與截圖</h3>
              <button type="button" onClick={handleLogout} style={{ padding: '6px 12px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>切換帳號 / 登出</button>
            </div>

            <p style={{ margin: '10px 0', fontSize: '15px' }}>目前登入角色：<strong style={{ color: '#2563eb', fontSize: '18px' }}>{loggedInUser}</strong></p>
            
            <div style={{ background: '#e0f2fe', borderLeft: '4px solid #0284c7', color: '#0369a1', padding: '10px 14px', borderRadius: '4px', fontSize: '14px', marginBottom: '15px' }}>
              💡 <strong>操作說明：</strong>上傳電腦版或手機版遊戲截圖，系統會自動掃描 LV 與 EXP。如有誤差可直接手動修改，修改後將標記提醒管理員審核！
            </div>

            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>1. 上傳證明截圖：</label>
            <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'block', margin: '5px 0 10px 0' }} />
            
            {scanning && <p style={{ color: '#d97706', fontSize: '14px', fontWeight: 'bold' }}>⚡ 正在智慧分析圖片中...</p>}
            
            {charNotice && (
              <div style={{ background: charNotice.includes('✅') ? '#f0fdf4' : '#fffbe0', border: '1px solid ' + (charNotice.includes('✅') ? '#bbf7d0' : '#fef08a'), color: charNotice.includes('✅') ? '#15803d' : '#854d0e', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', margin: '8px 0' }}>
                {charNotice}
              </div>
            )}

            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', marginTop: '15px' }}>2. 當前等級 (Lv)：</label>
            <input type="number" placeholder="例如：179" value={level} onChange={e => { setLevel(e.target.value); setIsManualEdited(true); }} style={{ display: 'block', margin: '5px 0 15px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />

            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>3. 當前經驗值數字 (EXP)：</label>
            <input 
              type="number" 
              placeholder="例如：352627350" 
              value={expVal} 
              onChange={e => { setExpVal(e.target.value); setIsManualEdited(true); }} 
              style={{ display: 'block', margin: '5px 0 15px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
            />

            <button type="submit" disabled={loading} style={{ padding: '12px 24px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', width: '100%' }}>
              {loading ? '提交中...' : '確認並提交成績'}
            </button>
          </form>

          {/* 📈 角色經驗值走勢圖 */}
          <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1e293b' }}>📈 【{loggedInUser}】的經驗值成長走勢</h3>
            {history.length < 2 ? (
              <p style={{ color: '#64748b', fontSize: '14px' }}>目前歷史紀錄不足（需要至少提交 2 次成績，才會生成成長折線圖喔！）</p>
            ) : (
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <svg width="100%" height="180" viewBox="0 0 500 180" style={{ background: '#f8fafc', borderRadius: '8px' }}>
                  {(() => {
                    const maxExp = Math.max(...history.map(h => h.total_exp || 0));
                    const minExp = Math.min(...history.map(h => h.total_exp || 0));
                    const expRange = (maxExp - minExp) || 1;
                    
                    const points = history.map((h, index) => {
                      const x = 40 + (index / (history.length - 1)) * 420;
                      const y = 140 - (((h.total_exp || 0) - minExp) / expRange) * 100;
                      return `${x},${y}`;
                    }).join(' ');

                    return (
                      <>
                        <polyline fill="none" stroke="#2563eb" strokeWidth="3" points={points} />
                        {history.map((h, index) => {
                          const x = 40 + (index / (history.length - 1)) * 420;
                          const y = 140 - (((h.total_exp || 0) - minExp) / expRange) * 100;
                          const dateStr = h.created_at ? new Date(h.created_at).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) : `第${index+1}次`;
                          return (
                            <g key={index}>
                              <circle cx={x} cy={y} r="5" fill="#1d4ed8" />
                              <text x={x} y={y - 10} fontSize="11" textAnchor="middle" fill="#1e293b" fontWeight="bold">Lv.{h.level}</text>
                              <text x={x} y="165" fontSize="10" textAnchor="middle" fill="#64748b">{dateStr}</text>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🏆 排行榜區塊 */}
      {!hasSubmitted ? (
        <div style={{ background: '#f1f5f9', padding: '30px', borderRadius: '12px', textAlign: 'center', color: '#475569', border: '2px dashed #cbd5e1' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>🔒 排行榜未解鎖</h3>
          <p style={{ margin: 0, fontSize: '15px' }}>請登入並<strong>完成一次截圖與成績提交</strong>，系統將為您即時解鎖練等大賽排行榜與獎品預覽！</p>
        </div>
      ) : (
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', marginTop: 0 }}>🏆 練等大賽即時排行榜</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '12px 8px' }}>名次</th>
                <th style={{ padding: '12px 8px' }}>角色名稱</th>
                <th style={{ padding: '12px 8px' }}>當前等級</th>
                <th style={{ padding: '12px 8px' }}>累積成長經驗值 (EXP)</th>
                <th style={{ padding: '12px 8px' }}>對應獎品</th>
                <th style={{ padding: '12px 8px' }}>更新時間</th>
              </tr>
            </thead>
            <tbody>
              {players.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>目前尚無比賽數據</td></tr>
              ) : (
                players.map((p, idx) => {
                  const timeStr = p.created_at ? new Date(p.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '無時間紀錄';
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 'bold', color: idx === 0 ? '#d97706' : idx === 1 ? '#64748b' : idx === 2 ? '#b45309' : '#334155' }}>
                        {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 'bold', color: '#0f172a' }}>{p.char_id}</td>
                      <td style={{ padding: '12px 8px' }}>Lv.{p.level}</td>
                      <td style={{ padding: '12px 8px', color: '#16a34a', fontWeight: 'bold' }}>
                        +{Number(p.growth_exp).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 'bold', fontSize: '13px', color: '#0284c7' }}>
                        {getPrizeBadge(idx)}
                      </td>
                      <td style={{ padding: '12px 8px', color: '#64748b', fontSize: '13px' }}>⏱️ {timeStr}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
