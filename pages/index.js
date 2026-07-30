import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// 🎯 活動截止時間：2026年9月8日 早上 07:59 (台灣時間)
const DEADLINE = new Date('2026-09-08T07:59:00+08:00').getTime();

// 🍁 根據精準規則自動生成 1~200 級經驗值對照表（120等基準 + 1.05倍）
function getExpRequiredForLevel(lv) {
  if (lv <= 0) return 0;
  if (lv === 120) return 29715818;
  if (lv > 120) {
    let exp = 29715818;
    for (let i = 121; i <= lv; i++) {
      exp = Math.floor(exp * 1.05);
    }
    return exp;
  }
  if (lv <= 15) return Math.floor(15 * Math.pow(1.3, lv - 1));
  if (lv <= 30) return Math.floor(1000 * Math.pow(1.2, lv - 15));
  if (lv <= 70) return Math.floor(15000 * Math.pow(1.15, lv - 30));
  if (lv <= 119) return Math.floor(200000 * Math.pow(1.1, lv - 70));
  return 15;
}

const REAL_EXP_TABLE = [];
for (let i = 0; i <= 200; i++) {
  REAL_EXP_TABLE[i] = getExpRequiredForLevel(i);
}

// 🌟 精準跨等成長計算邏輯
function calculateTrueGrowth(baseLv, baseExp, currLv, currExp) {
  if (currLv === baseLv) {
    return currExp - baseExp;
  }
  let growth = 0;
  growth += ((REAL_EXP_TABLE[baseLv] || 0) - baseExp);
  for (let i = baseLv + 1; i < currLv; i++) {
    growth += (REAL_EXP_TABLE[i] || 0);
  }
  growth += currExp;
  return growth > 0 ? growth : 0;
}

function getCumulativeExp(lv) {
  let total = 0;
  for (let i = 1; i < lv; i++) {
    total += (REAL_EXP_TABLE[i] || 0);
  }
  return total;
}

// 🎁 完整正式獎勵標籤
function getPrizeBadge(rank) {
  if (rank === 0) return '🥇 闇黑龍王披風';
  if (rank === 1) return '🥈 楓葉祝福 20';
  if (rank === 2) return '🥉 闇黑龍王項鍊';
  if (rank === 3) return '🏅 雪花 300';
  if (rank === 4) return '🏅 突襲劵 14 張';
  if (rank >= 5 && rank <= 13) return '🏅 突襲劵 7 張';
  if (rank === 14) return '🏅 商城寵物一隻';
  if (rank >= 15 && rank <= 19) return '🏅 雪花 50';
  return '🎗️ 努力參賽獎';
}

export default function Home() {
  const [charId, setCharId] = useState('');
  const [pin, setPin] = useState('');
  const [loggedInUser, setLoggedInUser] = useState('');
  const [newCharIdInput, setNewCharIdInput] = useState('');
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
  const [charNotice, setCharNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isEnded, setIsEnded] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('artale_user');
    if (savedUser) {
      setLoggedInUser(savedUser);
      setIsLoggedIn(true);
      fetchUserHistory(savedUser);
    }

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const difference = DEADLINE - now;

      if (difference <= 0) {
        setIsEnded(true);
        clearInterval(timer);
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  async function fetchLeaderboard() {
    if (!supabase) return;
    const { data } = await supabase.from('submissions').select('*').order('id', { ascending: true });

    if (data && data.length > 0) {
      const userGroup = {};
      data.forEach(sub => {
        const cleanName = (sub.char_id || '').trim();
        if (!cleanName) return;
        if (!userGroup[cleanName]) userGroup[cleanName] = [];
        userGroup[cleanName].push(sub);
      });

      const list = Object.keys(userGroup).map(id => {
        const subs = userGroup[id];
        const baseline = subs[0];
        const latest = subs[subs.length - 1];

        const baseLv = Number(baseline.level);
        const baseExp = Number(baseline.exp_val);
        const currLv = Number(latest.level);
        const currExp = Number(latest.exp_val);

        const expGrowth = calculateTrueGrowth(baseLv, baseExp, currLv, currExp);

        return {
          char_id: id,
          level: latest.level,
          exp_val: latest.exp_val,
          growth_exp: expGrowth,
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
    const { data } = await supabase.from('submissions').select('*').eq('char_id', cleanId).order('id', { ascending: true });
    if (data) setHistory(data);
  }

  async function handleAuth(e) {
    e.preventDefault();
    const cleanId = charId.trim();
    if (!supabase) return setMsg('Supabase 設定未完全');
    if (!cleanId || !pin) return setMsg('請輸入角色名稱與 4 位數 PIN 碼');

    const { data: user } = await supabase.from('participants').select('*').eq('char_id', cleanId).single();

    if (!user) {
      const { error } = await supabase.from('participants').insert([{ char_id: cleanId, pin }]);
      if (error) return setMsg('註冊失敗：' + error.message);
      setMsg('註冊成功並登入！');
      setLoggedInUser(cleanId);
      localStorage.setItem('artale_user', cleanId);
      setIsLoggedIn(true);
      setHasSubmitted(false);
      fetchUserHistory(cleanId);
    } else {
      if (user.pin !== pin) return setMsg('PIN 碼不正確！');
      setMsg('登入成功！');
      setLoggedInUser(cleanId);
      localStorage.setItem('artale_user', cleanId);
      setIsLoggedIn(true);
      setHasSubmitted(false);
      fetchUserHistory(cleanId);
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

  async function handleRename(e) {
    e.preventDefault();
    if (!supabase) return setMsg('Supabase 設定未完全');
    const targetName = newCharIdInput.trim();
    if (!targetName) return setMsg('請輸入新的角色名稱！');
    if (targetName === loggedInUser) return setMsg('新名稱不能與舊名稱相同！');

    const { data: existingUser } = await supabase.from('participants').select('*').eq('char_id', targetName).single();
    if (existingUser) return setMsg(`⚠️ 改名失敗：角色 ID 【${targetName}】 已有人使用！`);

    await supabase.from('participants').update({ char_id: targetName }).eq('char_id', loggedInUser);
    await supabase.from('submissions').update({ char_id: targetName }).eq('char_id', loggedInUser);

    const oldName = loggedInUser;
    setLoggedInUser(targetName);
    localStorage.setItem('artale_user', targetName);
    setNewCharIdInput('');
    setMsg(`🎉 改名成功！所有歷史成績已從【${oldName}】無縫轉移至【${targetName}】！`);
    
    fetchUserHistory(targetName);
    fetchLeaderboard();
  }

  async function handleUpdatePin(e) {
    e.preventDefault();
    if (!supabase) return setMsg('Supabase 設定未完全');
    if (!newPin || newPin.length !== 4) return setMsg('新密碼必須是 4 位數字！');

    const { error } = await supabase.from('participants').update({ pin: newPin }).eq('char_id', loggedInUser);
    if (error) {
      setMsg('修改密碼失敗：' + error.message);
    } else {
      setPin(newPin);
      setNewPin('');
      setMsg('密碼已成功修改為新密碼！');
    }
  }

  // 📸 關鍵升級：透過 Canvas 將圖片放大 2 倍並保持像素銳利，讓 OCR 能看清遊戲自訂字型
  async function preprocessAndScaleImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const scale = 2; // 放大 2 倍
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = false; // 保持像素邊緣清晰
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          canvas.toBlob((blob) => {
            resolve(URL.createObjectURL(blob));
          }, 'image/png');
        };
      };
    });
  }

  async function handleFileChange(e) {
    if (isEnded) return;
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setScanning(true);
    setDateNotice('');
    setCharNotice('');
    setMsg('⚡ 正在進行高畫質像素放大與介面解析...');

    try {
      // 先放大處理再交給 Tesseract
      const processedImageUrl = await preprocessAndScaleImage(selectedFile);

      if (window.Tesseract) {
        const result = await window.Tesseract.recognize(processedImageUrl, 'eng');
        const rawText = result.data.text || '';
        const flattenedText = rawText.replace(/[\s\-_]+/g, '').toLowerCase();
        const cleanUser = loggedInUser.replace(/[\s\-_]+/g, '').toLowerCase();

        // --- 1. 🎯 角色名稱比對 ---
        if (loggedInUser) {
          if (flattenedText.includes(cleanUser) || rawText.includes(loggedInUser)) {
            setCharNotice(`✅ 成功在截圖中偵測到您的角色名稱【${loggedInUser}】！`);
          } else {
            setCharNotice(`💡 溫馨提醒：截圖中未直接掃描到【${loggedInUser}】，幹部後台會進行最終審核。`);
          }
        }

        // --- 2. 🎯 精準等級 (LV) 抓取（結合精準正規表達式與數字安全防護） ---
        let detectedLv = '';
        const lvMatch = rawText.match(/(?:lv|l\/|l\.|lvl|level)[\s\.:\[]*(\d{1,3})/i) || 
                        flattenedText.match(/(?:lv|l\/|lvl|level)(\d{1,3})/);
        
        if (lvMatch && lvMatch[1]) {
          const val = Number(lvMatch[1]);
          if (val >= 1 && val <= 200) {
            detectedLv = String(val);
          }
        }
        
        if (!detectedLv) {
          const nums = rawText.match(/\b([1-9][0-9]?|1[0-9]{2}|200)\b/g);
          if (nums && nums.length > 0) {
            const validLvs = nums.map(Number).filter(n => n >= 50 && n <= 200);
            if (validLvs.length > 0) {
              detectedLv = String(validLvs[0]);
            } else {
              detectedLv = nums[0];
            }
          }
        }
        if (detectedLv) setLevel(detectedLv);

        // --- 3. 🎯 精準經驗值 (EXP) 抓取 ---
        let detectedExp = '';
        const expMatch = rawText.match(/EXP[\s\.:\[]*([\d,]+)/i) || flattenedText.match(/exp\[?(\d{5,12})/i);
        if (expMatch && expMatch[1]) {
          detectedExp = expMatch[1].replace(/[,.]/g, '');
        } else {
          const allLongNums = rawText.replace(/[,.]/g, '').match(/\d{5,12}/g);
          if (allLongNums && allLongNums.length > 0) {
            allLongNums.sort((a, b) => b.length - a.length);
            detectedExp = allLongNums[0];
          }
        }
        if (detectedExp) setExpVal(detectedExp);

        setMsg('🎉 掃描完成！請確認自動代入的數字，若有誤差可直接手動修改。');
      } else {
        setMsg('請手動填寫等級與經驗值。');
      }
      setScanning(false);
    } catch (err) {
      setMsg('💡 照片解析發生錯誤，請手動填寫數字。');
      setScanning(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (isEnded) return setMsg('⏰ 活動已截止，無法再提交新成績！');
    if (!supabase) return setMsg('Supabase 設定未完全');
    if (!file) return setMsg('請選擇截圖照片');
    if (!level || !expVal) return setMsg('請填寫或確認等級與經驗值');
    if (!loggedInUser) return setMsg('登入狀態異常，請重新登入');

    setLoading(true);
    setMsg('照片與成績上傳中...');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('screenshots').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('screenshots').getPublicUrl(fileName);
      const photoUrl = publicUrlData.publicUrl;
      const targetLevel = Number(level);
      const inputExpNum = Number(expVal);
      const calculatedTotalExp = getCumulativeExp(targetLevel) + inputExpNum;

      const { error: subError } = await supabase.from('submissions').insert([{
        char_id: loggedInUser.trim(),
        level: targetLevel,
        exp_val: inputExpNum,
        total_exp: calculatedTotalExp,
        photo_url: photoUrl,
        status: 'approved'
      }]);

      if (subError) throw subError;

      setMsg('🎉 成績已成功提交！排行榜已為您解鎖並更新。');
      setHasSubmitted(true);
      fetchLeaderboard();
      fetchUserHistory(loggedInUser);
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

      <h1 style={{ textAlign: 'center', color: '#1e293b', marginBottom: '5px' }}>🍁 Artale 夏日練等大賽</h1>

      <div style={{ background: isEnded ? '#fef2f2' : '#f0fdf4', border: '2px solid ' + (isEnded ? '#fecdd3' : '#bbf7d0'), padding: '12px 20px', borderRadius: '12px', textAlign: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, color: isEnded ? '#dc2626' : '#15803d' }}>
          {isEnded ? '⏰ 活動已於 9月8日 07:59 正式截止結算！' : '⏱️ 活動剩餘倒數時間（結算截止：9/8 07:59）'}
        </h3>
        {!isEnded && (
          <p style={{ margin: '8px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#0369a1' }}>
            ⏳ {timeLeft.days} 天 {timeLeft.hours} 小時 {timeLeft.minutes} 分鐘 {timeLeft.seconds} 秒
          </p>
        )}
      </div>

      {msg && <div style={{ background: '#3b82f6', color: '#fff', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontWeight: 'bold' }}>{msg}</div>}

      {!isLoggedIn ? (
        <form onSubmit={handleAuth} style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
          <h3>🔑 玩家登入 / 報名</h3>
          <input type="text" placeholder="遊戲角色 ID" value={charId} onChange={e => setCharId(e.target.value)} style={{ display: 'block', margin: '10px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
          <input type="password" placeholder="自訂 4 位數預設 PIN 碼" value={pin} onChange={e => setPin(e.target.value)} style={{ display: 'block', margin: '10px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
          <button type="submit" style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>登入 / 註冊</button>
        </form>
      ) : (
        <div>
          <form onSubmit={handleSubmit} style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>📸 回報等級與截圖</h3>
              <button type="button" onClick={handleLogout} style={{ padding: '6px 12px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>切換帳號 / 登出</button>
            </div>

            <p style={{ margin: '10px 0', fontSize: '15px' }}>目前登入角色：<strong style={{ color: '#2563eb', fontSize: '18px' }}>{loggedInUser}</strong></p>
            
            <div style={{ background: '#e0f2fe', borderLeft: '4px solid #0284c7', color: '#0369a1', padding: '10px 14px', borderRadius: '4px', fontSize: '14px', marginBottom: '15px' }}>
              💡 <strong>操作說明：</strong>上傳截圖後系統會自動進行高畫質像素放大辨識，若有誤差可直接手動修正數字再提交！
            </div>

            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>1. 上傳證明截圖：</label>
            <input type="file" accept="image/*" disabled={isEnded} onChange={handleFileChange} style={{ display: 'block', margin: '5px 0 10px 0' }} />
            
            {scanning && <p style={{ color: '#d97706', fontSize: '14px', fontWeight: 'bold' }}>⚡ 正在進行高畫質像素解析...</p>}

            {charNotice && (
              <div style={{ background: charNotice.includes('✅') ? '#f0fdf4' : '#fffbe0', border: '1px solid ' + (charNotice.includes('✅') ? '#bbf7d0' : '#fef08a'), color: charNotice.includes('✅') ? '#15803d' : '#854d0e', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', margin: '8px 0' }}>
                {charNotice}
              </div>
            )}

            {dateNotice && (
              <div style={{ background: dateNotice.includes('✅') ? '#f0fdf4' : '#fffbe0', border: '1px solid ' + (dateNotice.includes('✅') ? '#bbf7d0' : '#fef08a'), color: dateNotice.includes('✅') ? '#15803d' : '#854d0e', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', margin: '8px 0' }}>
                {dateNotice}
              </div>
            )}

            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', marginTop: '15px' }}>2. 當前等級 (Lv)：</label>
            <input type="number" placeholder="例如：173" disabled={isEnded} value={level} onChange={e => setLevel(e.target.value)} style={{ display: 'block', margin: '5px 0 15px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />

            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>3. 當前經驗值數字 (EXP)：</label>
            <input 
              type="number" 
              placeholder="例如：246011374" 
              disabled={isEnded}
              value={expVal} 
              onChange={e => setExpVal(e.target.value)} 
              style={{ display: 'block', margin: '5px 0 15px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
            />

            <button type="submit" disabled={loading || isEnded} style={{ padding: '12px 24px', background: isEnded ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: isEnded ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px', width: '100%' }}>
              {isEnded ? '🔒 活動已截止停用上傳' : loading ? '提交中...' : '確認並提交成績'}
            </button>
          </form>

          {/* 📈 角色經驗值走勢圖與歷史明細表格 */}
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1e293b' }}>📈 【{loggedInUser}】的經驗值成長走勢與歷史紀錄</h3>
            {history.length < 2 ? (
              <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '15px' }}>目前歷史紀錄不足（需要至少提交 2 次成績，才會生成成長折線圖喔！）</p>
            ) : (
              <div style={{ width: '100%', overflowX: 'auto', marginBottom: '20px' }}>
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

            {/* 📋 個人歷史提交紀錄表格 */}
            {history.length > 0 && (
              <div>
                <h4 style={{ margin: '15px 0 10px 0', color: '#334155', fontSize: '15px' }}>📜 個人歷次回報明細：</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '8px' }}>次數</th>
                        <th style={{ padding: '8px' }}>等級</th>
                        <th style={{ padding: '8px' }}>經驗值 (EXP)</th>
                        <th style={{ padding: '8px' }}>截圖證明</th>
                        <th style={{ padding: '8px' }}>回報時間</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h, idx) => {
                        const timeStr = h.created_at ? new Date(h.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '無時間';
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px', fontWeight: 'bold' }}>#{idx + 1}</td>
                            <td style={{ padding: '8px' }}>Lv.{h.level}</td>
                            <td style={{ padding: '8px' }}>{Number(h.exp_val || 0).toLocaleString()}</td>
                            <td style={{ padding: '8px' }}>
                              {h.photo_url ? (
                                <a href={h.photo_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>查看截圖</a>
                              ) : '無'}
                            </td>
                            <td style={{ padding: '8px', color: '#64748b' }}>{timeStr}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#1e293b' }}>⚙️ 個人帳號管理設定</h4>
            
            <form onSubmit={handleRename} style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>🔄 角色遊戲內改名 / 轉移數據：</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" placeholder="輸入遊戲內的新角色 ID" value={newCharIdInput} onChange={e => setNewCharIdInput(e.target.value)} style={{ padding: '8px', width: '100%', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                <button type="submit" style={{ padding: '8px 16px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 'bold' }}>確認改名</button>
              </div>
            </form>

            <form onSubmit={handleUpdatePin}>
              <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>🔑 修改個人 4 位數 PIN 碼：</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="password" maxLength={4} placeholder="輸入新 4 位數密碼" value={newPin} onChange={e => setNewPin(e.target.value)} style={{ padding: '8px', width: '100%', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                <button type="submit" style={{ padding: '8px 16px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 'bold' }}>更新密碼</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🏆 排行榜區塊 */}
      {!hasSubmitted ? (
        <div style={{ background: '#f1f5f9', padding: '30px', borderRadius: '12px', textAlign: 'center', color: '#475569', border: '2px dashed #cbd5e1' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>🔒 排行榜未解鎖</h3>
          <p style={{ margin: 0, fontSize: '15px' }}>請登入並<strong>完成當次截圖與成績提交</strong>，系統將為您即時解鎖練等大賽排行榜！</p>
        </div>
      ) : (
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', marginTop: 0 }}>🏆 練等大賽即時排行榜 (活動成長量排名)</h2>
          
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 8px' }}>名次</th>
                  <th style={{ padding: '12px 8px' }}>角色名稱</th>
                  <th style={{ padding: '12px 8px' }}>當前等級</th>
                  <th style={{ padding: '12px 8px' }}>累積成長經驗值 (EXP)</th>
                  <th style={{ padding: '12px 8px' }}>當前對應獎品</th>
                  <th style={{ padding: '12px 8px' }}>最後更新時間</th>
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
        </div>
      )}
    </div>
  );
}
