import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export default function Home() {
  const [charId, setCharId] = useState('');
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [level, setLevel] = useState('');
  const [expVal, setExpVal] = useState('');
  const [file, setFile] = useState(null);
  const [players, setPlayers] = useState([]);
  const [history, setHistory] = useState([]);
  const [msg, setMsg] = useState('');
  const [dateNotice, setDateNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (isLoggedIn && charId) {
      fetchUserHistory(charId);
    }
  }, [isLoggedIn, charId]);

  // 🏆 抓取所有提交紀錄，計算每個人的「活動成長總經驗值」
  async function fetchLeaderboard() {
    if (!supabase) return;
    const { data } = await supabase
      .from('submissions')
      .select('*')
      .order('id', { ascending: true }); // 按時間序從舊到新

    if (data && data.length > 0) {
      const userGroup = {};
      data.forEach(sub => {
        if (!userGroup[sub.char_id]) {
          userGroup[sub.char_id] = [];
        }
        userGroup[sub.char_id].push(sub);
      });

      const list = Object.keys(userGroup).map(id => {
        const subs = userGroup[id];
        const baseline = subs[0]; // 活動第一次提交（基準）
        const latest = subs[subs.length - 1]; // 最新提交

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

      // 依「成長經驗值」從高到低排序
      list.sort((a, b) => b.growth_exp - a.growth_exp);
      setPlayers(list);
    }
  }

  async function fetchUserHistory(id) {
    if (!supabase) return;
    const { data } = await supabase
      .from('submissions')
      .select('*')
      .eq('char_id', id)
      .order('id', { ascending: true });

    if (data) {
      setHistory(data);
      if (data.length > 0) {
        setHasSubmitted(true); // 玩家有提交過照片，允許看排行榜
        fetchLeaderboard();
      }
    }
  }

  async function handleAuth(e) {
    e.preventDefault();
    if (!supabase) return setMsg('Supabase 設定未完全');
    if (!charId || !pin) return setMsg('請輸入角色名稱與 4 位數 PIN 碼');

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

  async function handleUpdatePin(e) {
    e.preventDefault();
    if (!newPin || newPin.length !== 4) return setMsg('新密碼必須是 4 位數字！');

    const { error } = await supabase
      .from('participants')
      .update({ pin: newPin })
      .eq('char_id', charId);

    if (error) {
      setMsg('修改密碼失敗：' + error.message);
    } else {
      setPin(newPin);
      setNewPin('');
      setMsg('密碼已成功修改為新密碼！下次請用新密碼登入。');
    }
  }

  function prepareImageForOCR(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1600;
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
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // 📸 日期掃描（包含 0730、7/30、7月30日 等各式組合）
  async function handleFileChange(e) {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setScanning(true);
    setDateNotice('');
    setMsg('🔍 正在辨識截圖內容...');

    const now = new Date();
    const YYYY = now.getFullYear();
    const M = now.getMonth() + 1;
    const D = now.getDate();
    const MM = String(M).padStart(2, '0');
    const DD = String(D).padStart(2, '0');

    const mmddStr = `${MM}${DD}`; // 如 "0730"
    const mddStr = `${M}${DD}`;   // 如 "730"

    try {
      const ocrImage = await prepareImageForOCR(selectedFile);

      if (window.Tesseract) {
        const result = await window.Tesseract.recognize(ocrImage, 'eng');
        const text = result.data.text;

        const pattern1 = new RegExp(`${YYYY}[/\\-.](0?${M})[/\\-.](0?${D})`, 'i');
        const pattern2 = new RegExp(`(^|[^\\d])(0?${M})[/\\-.](0?${D})([^\\d]|$)`, 'i');
        const pattern3 = new RegExp(`(0?${M})月(0?${D})`, 'i');
        const pattern4 = new RegExp(`(${mmddStr}|${mddStr})`, 'i');

        const hasDateMatch = pattern1.test(text) || pattern2.test(text) || pattern3.test(text) || pattern4.test(text);

        if (hasDateMatch) {
          setDateNotice(`✅ 成功辨識今日日期標記（${M}/${D} 或 ${mmddStr}）！`);
        } else {
          setDateNotice(`💡 提醒：若畫面右下角或聊天室已包含今日日期（如 ${M}/${D}、${mmddStr}），管理員後台會進行人工審核。`);
        }

        const numbers = text.match(/\d+/g);
        if (numbers && numbers.length > 0) {
          const possibleLv = numbers.find(n => Number(n) >= 1 && Number(n) <= 300);
          const possibleExp = numbers.find(n => n.length >= 4);

          if (possibleLv) setLevel(possibleLv);
          if (possibleExp) setExpVal(possibleExp);

          setMsg('✨ 自動帶入完成！若數字有偏差請手動修改。');
        } else {
          setMsg('圖片已選擇！請手動確認填寫等級與經驗值。');
        }
      }
    } catch (err) {
      setMsg('圖片已選擇，請手動確認等級與經驗值。');
    } finally {
      setScanning(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return setMsg('請選擇截圖照片');
    if (!level || !expVal) return setMsg('請填寫或確認等級與經驗值');

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

      setMsg('🎉 成績已成功提交！排行榜已為您更新。');
      setHasSubmitted(true); // 上傳完成解鎖排行榜
      fetchLeaderboard();
      fetchUserHistory(charId);
    } catch (err) {
      setMsg('上傳失敗：' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <Head>
        <title>Artale 夏日練等大賽</title>
        <script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
      </Head>

      <h1 style={{ textAlign: 'center', color: '#1e293b' }}>🍁 Artale 夏日練等大賽</h1>

      {msg && <div style={{ background: '#3b82f6', color: '#fff', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontWeight: 'bold' }}>{msg}</div>}

      {!isLoggedIn ? (
        <form onSubmit={handleAuth} style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
          <h3>🔑 玩家登入 / 報名</h3>
          <input type="text" placeholder="遊戲角色 ID" value={charId} onChange={e => setCharId(e.target.value)} style={{ display: 'block', margin: '10px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          <input type="password" placeholder="自訂 4 位數預設 PIN 碼" value={pin} onChange={e => setPin(e.target.value)} style={{ display: 'block', margin: '10px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          <button type="submit" style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>登入 / 註冊</button>
        </form>
      ) : (
        <div>
          {/* 回報成績表單 */}
          <form onSubmit={handleSubmit} style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <h3>📸 回報等級與截圖 (目前登入：<span style={{ color: '#2563eb' }}>{charId}</span>)</h3>
            
            <div style={{ background: '#e0f2fe', borderLeft: '4px solid #0284c7', color: '#0369a1', padding: '10px 14px', borderRadius: '4px', fontSize: '14px', marginBottom: '15px' }}>
              💡 <strong>操作說明：</strong>選擇今日截圖（含右下角時間或日期格式如 0730、7/30）後上傳，系統會自動辨識並幫您累積活動經驗值！
            </div>

            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>1. 上傳證明截圖：</label>
            <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'block', margin: '5px 0 10px 0' }} />
            
            {scanning && <p style={{ color: '#d97706', fontSize: '14px', fontWeight: 'bold' }}>⚡ 正在分析圖片中...</p>}
            
            {dateNotice && (
              <div style={{ background: dateNotice.includes('✅') ? '#f0fdf4' : '#fffbe0', border: '1px solid ' + (dateNotice.includes('✅') ? '#bbf7d0' : '#fef08a'), color: dateNotice.includes('✅') ? '#15803d' : '#854d0e', padding: '10px', borderRadius: '6px', fontSize: '14px', margin: '10px 0' }}>
                {dateNotice}
              </div>
            )}

            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', marginTop: '15px' }}>2. 當前等級 (Lv)：</label>
            <input type="number" placeholder="例如：120" value={level} onChange={e => setLevel(e.target.value)} style={{ display: 'block', margin: '5px 0 15px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1' }} />

            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>3. 當前經驗值數字 (EXP)：</label>
            <input type="number" placeholder="例如：246011374" value={expVal} onChange={e => setExpVal(e.target.value)} style={{ display: 'block', margin: '5px 0 15px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1' }} />

            <button type="submit" disabled={loading} style={{ padding: '12px 24px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', width: '100%' }}>
              {loading ? '提交中...' : '確認並提交成績'}
            </button>
          </form>

          {/* 📈 角色經驗值走勢圖 */}
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1e293b' }}>📈 【{charId}】的經驗值成長走勢</h3>
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

          {/* 修改 PIN 碼表單 */}
          <form onSubmit={handleUpdatePin} style={{ background: '#fff1f2', padding: '15px 20px', borderRadius: '12px', border: '1px solid #fecdd3', marginBottom: '30px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#9f1239' }}>⚙️ 修改個人的 4 位數 PIN 碼</h4>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="password" maxLength={4} placeholder="輸入新 4 位數密碼" value={newPin} onChange={e => setNewPin(e.target.value)} style={{ padding: '8px', width: '100%', borderRadius: '4px', border: '1px solid #fda4af' }} />
              <button type="submit" style={{ padding: '8px 16px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 'bold' }}>更新密碼</button>
            </div>
          </form>
        </div>
      )}

      {/* 🏆 排行榜區塊 (僅限上傳照片後展示) */}
      {!hasSubmitted ? (
        <div style={{ background: '#f1f5f9', padding: '30px', borderRadius: '12px', textAlign: 'center', color: '#475569', border: '2px dashed #cbd5e1' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>🔒 排行榜已鎖定</h3>
          <p style={{ margin: 0, fontSize: '15px' }}>請先完成登入並<strong>成功提交一次比賽截圖成績</strong>，即可解鎖並查看活動即時排行榜！</p>
        </div>
      ) : (
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', marginTop: 0 }}>🏆 練等大賽即時排行榜 (活動成長量排名)</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '12px 8px' }}>名次</th>
                <th style={{ padding: '12px 8px' }}>角色名稱</th>
                <th style={{ padding: '12px 8px' }}>當前等級</th>
                <th style={{ padding: '12px 8px' }}>累積成長經驗值 (EXP)</th>
                <th style={{ padding: '12px 8px' }}>最後更新時間</th>
              </tr>
            </thead>
            <tbody>
              {players.length === 0 ? (
                <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>目前尚無比賽數據</td></tr>
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
