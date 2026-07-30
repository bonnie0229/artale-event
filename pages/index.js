import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// 活動截止時間：2026年9月8日 早上 07:59 (台灣時間)
const DEADLINE = new Date('2026-09-08T07:59:00+08:00').getTime();

// 🍁 Artale 1~200 級「每一級升等所需」的經驗值對照表（120等後每升一等為上一等級的 1.05 倍）
function getExpRequiredForLevel(lv) {
  if (lv <= 1) return 15;
  if (lv <= 15) return Math.floor(15 * Math.pow(1.3, lv - 1));
  if (lv <= 30) return Math.floor(1000 * Math.pow(1.2, lv - 15));
  if (lv <= 70) return Math.floor(15000 * Math.pow(1.15, lv - 30));
  if (lv <= 120) return Math.floor(200000 * Math.pow(1.1, lv - 70));
  if (lv <= 200) return Math.floor(5000000 * Math.pow(1.05, lv - 120));
  return 1000000000;
}

// 🎯 核心成長計算邏輯：以第一次基準點為出發點，精準計算升等前未記錄到與跨等時的總成長經驗值
function calculateGrowthExp(baseline, latest) {
  const baseLv = Number(baseline.level);
  const baseExp = Number(baseline.exp_val) || 0;
  const currLv = Number(latest.level);
  const currExp = Number(latest.exp_val) || 0;

  // 如果等級完全相同，直接相減經驗值零頭
  if (currLv === baseLv) {
    return Math.max(0, currExp - baseExp);
  }

  // 如果等級上升了，分三段精準計算：
  let totalGrowth = 0;

  // 1. 基準那一級剩餘未練完的經驗值
  const baseLevelReq = getExpRequiredForLevel(baseLv);
  totalGrowth += Math.max(0, baseLevelReq - baseExp);

  // 2. 中間跨過去的完整等級經驗值
  for (let l = baseLv + 1; l < currLv; l++) {
    totalGrowth += getExpRequiredForLevel(l);
  }

  // 3. 最新那一級目前已練到的經驗值
  totalGrowth += currExp;

  return totalGrowth;
}

// 🎁 活動獎勵名次對應標籤
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
      fetchLeaderboard();
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
        const baseline = subs[0]; // 第一筆為 7/30 起始基準成績
        const latest = subs[subs.length - 1]; // 最新一筆為當前成績

        // 透過新的成長計算函式得出總成長經驗值
        const expGrowth = calculateGrowthExp(baseline, latest);

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
    if (!supabase) return setMsg('⚠️ Supabase 設定未完全');
    if (!cleanId || !pin) return setMsg('⚠️ 請輸入角色名稱與 4 位數 PIN 碼');

    const { data: user } = await supabase.from('participants').select('*').eq('char_id', cleanId).single();
    if (!user) {
      const { error } = await supabase.from('participants').insert([{ char_id: cleanId, pin }]);
      if (error) return setMsg('❌ 註冊失敗：' + error.message);
      setMsg('🎉 註冊成功並登入！');
      setLoggedInUser(cleanId);
      localStorage.setItem('artale_user', cleanId);
      setIsLoggedIn(true);
      setHasSubmitted(false);
      fetchUserHistory(cleanId);
    } else {
      if (user.pin !== pin) return setMsg('❌ PIN 碼不正確！');
      setMsg('✅ 登入成功！');
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
    if (!supabase) return setMsg('⚠️ Supabase 設定未完全');
    const targetName = newCharIdInput.trim();
    if (!targetName) return setMsg('⚠️ 請輸入新的角色名稱！');
    if (targetName === loggedInUser) return setMsg('⚠️ 新名稱不能與舊名稱相同！');

    const { data: existingUser } = await supabase.from('participants').select('*').eq('char_id', targetName).single();
    if (existingUser) return setMsg(`⚠️ 改名失敗：角色 ID 【${targetName}】 已有人使用！`);

    await supabase.from('participants').update({ char_id: targetName }).eq('char_id', loggedInUser);
    await supabase.from('submissions').update({ char_id: targetName }).eq('char_id', loggedInUser);

    const oldName = loggedInUser;
    setLoggedInUser(targetName);
    localStorage.setItem('artale_user', targetName);
    setNewCharIdInput('');
    setMsg(`🎉 改名成功！歷史成績已從【${oldName}】轉移至【${targetName}】！`);
    fetchUserHistory(targetName);
    fetchLeaderboard();
  }

  async function handleUpdatePin(e) {
    e.preventDefault();
    if (!supabase) return setMsg('⚠️ Supabase 設定未完全');
    if (!newPin || newPin.length !== 4) return setMsg('⚠️ 新密碼必須是 4 位數字！');

    const { error } = await supabase.from('participants').update({ pin: newPin }).eq('char_id', loggedInUser);
    if (error) {
      setMsg('❌ 修改密碼失敗：' + error.message);
    } else {
      setPin(newPin);
      setNewPin('');
      setMsg('✅ 密碼已成功修改！');
    }
  }

  function prepareImageForOCR(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1800;
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
          resolve(canvas.toDataURL('image/jpeg', 0.92));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // 📸 自動精準辨識與填入
  async function handleFileChange(e) {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setScanning(true);
    setMsg('🔍 正在自動解析截圖中的等級與經驗值...');

    try {
      const ocrImage = await prepareImageForOCR(selectedFile);

      if (window.Tesseract) {
        const result = await window.Tesseract.recognize(ocrImage, 'eng');
        const text = result.data.text;
        
        let foundLv = '';
        const lines = text.split('\n');
        for (let line of lines) {
          const match = line.match(/(?:lv|level|l\/|ln)[\s\.:]*(\d{1,3})/i);
          if (match && match[1]) {
            const val = Number(match[1]);
            if (val >= 1 && val <= 200) {
              foundLv = String(val);
              break;
            }
          }
        }
        if (!foundLv) {
          const allPotentialLvs = text.match(/\b([1-9][0-9]|1[0-9]{2}|200)\b/g);
          if (allPotentialLvs) {
            const valid = allPotentialLvs.map(Number).filter(n => n >= 30 && n <= 200);
            if (valid.length > 0) {
              foundLv = String(valid[valid.length - 1]);
            }
          }
        }
        if (foundLv) setLevel(foundLv);

        let foundExp = '';
        const expMatch = text.match(/exp[\s\.:]*([\d,.]+)/i);
        if (expMatch && expMatch[1]) {
          foundExp = expMatch[1].replace(/[,.]/g, '');
          setExpVal(foundExp);
        } else {
          const allNums = text.replace(/[,.]/g, '').match(/\d{6,10}/g);
          if (allNums && allNums.length > 0) {
            allNums.sort((a, b) => b.length - a.length);
            foundExp = allNums[0];
            setExpVal(foundExp);
          }
        }

        if (foundLv || foundExp) {
          setMsg('✨ 自動辨識成功！數值已填入，請確認是否正確，若有誤差可手動修改。');
        } else {
          setMsg('💡 未能自動辨識，請手動輸入等級與經驗值。');
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
    if (isEnded) return setMsg('⏰ 活動已截止，無法再提交新成績！');
    if (!supabase) return setMsg('⚠️ Supabase 設定未完全');
    if (!file) return setMsg('⚠️ 請上傳 7/30 以後的截圖照片');
    if (!level || !expVal) return setMsg('⚠️ 請填寫等級與經驗值');
    if (!loggedInUser) return setMsg('⚠️ 登入狀態異常，請重新登入');

    setLoading(true);
    setMsg('成績上傳與成長經驗計算中...');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('screenshots').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('screenshots').getPublicUrl(fileName);
      const photoUrl = publicUrlData.publicUrl;
      const targetLevel = Number(level);
      const inputExpNum = Number(expVal);

      // 直接儲存當前等級與零頭經驗值，由前端動態計算成長量
      const { error: subError } = await supabase.from('submissions').insert([{
        char_id: loggedInUser.trim(),
        level: targetLevel,
        exp_val: inputExpNum,
        total_exp: 0, // 保留欄位，改用動態區間計算
        photo_url: photoUrl,
        status: 'approved',
        is_manually_edited: true,
        checked_by: null
      }]);

      if (subError) throw subError;

      setMsg('🎉 成績提交成功！排行榜已為您更新。');
      setHasSubmitted(true);
      await fetchUserHistory(loggedInUser);
      await fetchLeaderboard();
    } catch (err) {
      setMsg('❌ 上傳失敗：' + err.message);
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
          {isEnded ? '⏰ 活動已於 9月8日 07:59 正式截止結算！' : '⏱️ 活動剩餘時間（結算截止：9/8 07:59）'}
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
              <h3 style={{ margin: 0 }}>📸 上傳 7/30 以後截圖與更新成績</h3>
              <button type="button" onClick={handleLogout} style={{ padding: '6px 12px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>切換帳號 / 登出</button>
            </div>

            <p style={{ margin: '10px 0', fontSize: '15px' }}>目前登入角色：<strong style={{ color: '#2563eb', fontSize: '18px' }}>{loggedInUser}</strong></p>
            
            <div style={{ background: '#e0f2fe', borderLeft: '4px solid #0284c7', color: '#0369a1', padding: '10px 14px', borderRadius: '4px', fontSize: '14px', marginBottom: '15px' }}>
              💡 <strong>操作說明：</strong>首次上傳將作為 7/30 起始基準點，後續上傳系統會自動計算您跨越升級與未記錄經驗的總成長量！
            </div>

            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>1. 上傳 7/30 以後截圖：</label>
            <input type="file" accept="image/*" disabled={isEnded} onChange={handleFileChange} style={{ display: 'block', margin: '5px 0 10px 0' }} />
            
            {scanning && <p style={{ color: '#d97706', fontSize: '14px', fontWeight: 'bold' }}>⚡ 正在自動解析截圖中的等級與經驗值...</p>}

            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', marginTop: '15px' }}>2. 當前等級 (Lv)：</label>
            <input 
              type="number" 
              placeholder="例如：173" 
              disabled={isEnded} 
              value={level} 
              onChange={e => setLevel(e.target.value)} 
              style={{ display: 'block', margin: '5px 0 15px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
            />

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

          {/* 📜 個人歷史提交紀錄與成長明細 */}
          {history.length > 0 && (
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>📊 您的歷史成績與跨等成長紀錄明細</h4>
              <ul style={{ paddingLeft: '20px', margin: 0, color: '#475569', fontSize: '14px' }}>
                {history.map((h, idx) => {
                  const timeStr = h.created_at ? new Date(h.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                  const baseline = history[0];
                  const growthFromBase = calculateGrowthExp(baseline, h);
                  return (
                    <li key={idx} style={{ marginBottom: '6px' }}>
                      第 {idx + 1} 次紀錄 — 等級：<strong>Lv.{h.level}</strong>，經驗值零頭：<code>{Number(h.exp_val).toLocaleString()}</code>，累積總成長：<code style={{ color: '#16a34a', fontWeight: 'bold' }}>+{growthFromBase.toLocaleString()}</code> ({timeStr})
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* ⚙️ 個人帳號管理設定 */}
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#1e293b' }}>⚙️ 個人帳號管理設定</h4>
            <form onSubmit={handleUpdatePin} style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>🔑 修改個人 4 位數 PIN 碼：</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="password" maxLength={4} placeholder="輸入新 4 位數密碼" value={newPin} onChange={e => setNewPin(e.target.value)} style={{ padding: '8px', width: '100%', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                <button type="submit" style={{ padding: '8px 16px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 'bold' }}>更新密碼</button>
              </div>
            </form>

            <form onSubmit={handleRename}>
              <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>🔄 角色遊戲內改名 / 轉移數據：</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" placeholder="輸入遊戲內的新角色 ID" value={newCharIdInput} onChange={e => setNewCharIdInput(e.target.value)} style={{ padding: '8px', width: '100%', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                <button type="submit" style={{ padding: '8px 16px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 'bold' }}>確認改名</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🏆 排行榜區塊 */}
      {!hasSubmitted ? (
        <div style={{ background: '#f1f5f9', padding: '30px', borderRadius: '12px', textAlign: 'center', color: '#475569', border: '2px dashed #cbd5e1' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>🔒 排行榜未解鎖</h3>
          <p style={{ margin: 0, fontSize: '15px' }}>請登入並<strong>完成當次成績提交</strong>，系統將為您即時解鎖練等大賽排行榜！</p>
        </div>
      ) : (
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', marginBottom: '15px' }}>
            <h2 style={{ color: '#0f172a', margin: 0 }}>🏆 練等大賽即時排行榜 (活動成長量排名)</h2>
            <button 
              onClick={() => setHasSubmitted(false)} 
              style={{ padding: '6px 14px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
            >
              🔒 鎖定並返回上一頁
            </button>
          </div>
          
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 8px' }}>名次</th>
                  <th style={{ padding: '12px 8px' }}>角色名稱</th>
                  <th style={{ padding: '12px 8px' }}>當前等級與零頭</th>
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
                        <td style={{ padding: '12px 8px' }}>Lv.{p.level} ({Number(p.exp_val).toLocaleString()})</td>
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
