import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// 🍁 Artale 120~200 等精準經驗值對照表
const EXACT_EXP_TABLE = {
  120: 29715818, 121: 31344244, 122: 33061908, 123: 34873700, 124: 36784778,
  125: 38800583, 126: 40926854, 127: 43169645, 128: 45535341, 129: 48030677,
  130: 50662758, 131: 53439077, 132: 56367538, 133: 59456479, 134: 62714694,
  135: 66151459, 136: 69776558, 137: 73600313, 138: 77633610, 139: 81887931,
  140: 86375389, 141: 91108760, 142: 96101520, 143: 101367883, 144: 106922842,
  145: 112782213, 146: 118962678, 147: 125481832, 148: 132358236, 149: 139611467,
  150: 147262175, 151: 155332142, 152: 163844343, 153: 172823012, 154: 182293713,
  155: 192283408, 156: 202820538, 157: 213935103, 158: 225658746, 159: 238024845,
  160: 251068606, 161: 264827165, 162: 279339693, 163: 294647508, 164: 310794191,
  165: 327825712, 166: 345790561, 167: 364739883, 168: 384727628, 169: 405810702,
  170: 428049128, 171: 451506220, 172: 476248760, 173: 502347192, 174: 529875818,
  175: 558913012, 176: 589541445, 177: 621848316, 178: 655925603, 179: 691870326,
  180: 729784819, 181: 769777027, 182: 811960808, 183: 856456260, 184: 903390063,
  185: 952895838, 186: 1005114529, 187: 1060194805, 188: 1118293480, 189: 1179575962,
  190: 1244216724, 191: 1312399800, 192: 1384319309, 193: 1460180007, 194: 1540197871,
  195: 1624600714, 196: 1713628833, 197: 1807535693, 198: 1906588648, 199: 2011069705,
  200: 2121276324
};

function getExpRequiredForLevel(lv) {
  if (EXACT_EXP_TABLE[lv]) return EXACT_EXP_TABLE[lv];
  if (lv > 200) return 2121276324;
  return 29715818;
}

function calculateGrowthExp(baseline, current) {
  if (!baseline || !current) return 0;
  const baseLv = Number(baseline.level);
  const baseExp = Number(baseline.exp_val);
  const currLv = Number(current.level);
  const currExp = Number(current.exp_val);

  if (baseLv === currLv) {
    return currExp - baseExp >= 0 ? currExp - baseExp : 0;
  }

  let totalGrowth = 0;
  const baseLevelReq = getExpRequiredForLevel(baseLv);
  totalGrowth += (baseLevelReq - baseExp);

  for (let lv = baseLv + 1; lv < currLv; lv++) {
    totalGrowth += getExpRequiredForLevel(lv);
  }
  totalGrowth += currExp;
  return totalGrowth >= 0 ? totalGrowth : 0;
}

function renderPrizeCell(rank) {
  if (rank === 0) return <div><div style={{ fontWeight: 'bold', color: '#d97706' }}>🥇 第一名／闇黑龍王披風一件</div><div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>美國阿翔贊助</div></div>;
  if (rank === 1) return <div><div style={{ fontWeight: 'bold', color: '#64748b' }}>🥈 第二名／楓葉祝福２０一本</div><div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>美國阿翔贊助</div></div>;
  if (rank === 2) return <div><div style={{ fontWeight: 'bold', color: '#b45309' }}>🥉 第三名／闇黑龍王項鍊一條</div><div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>美國阿翔贊助</div></div>;
  if (rank === 3) return <div style={{ fontWeight: 'bold', color: '#0284c7' }}>🏅 第四名／雪花 300</div>;
  if (rank === 4) return <div><div style={{ fontWeight: 'bold', color: '#0284c7' }}>🏅 第五名／突襲劵 14 張</div><div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>夏日活動贊助商贊助</div></div>;
  if (rank >= 5 && rank <= 13) return <div><div style={{ fontWeight: 'bold', color: '#0284c7' }}>🏅 第六~十四名／突襲劵 7 張</div><div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>夏日活動贊助商贊助</div></div>;
  if (rank === 14) return <div><div style={{ fontWeight: 'bold', color: '#0284c7' }}>🏅 第十五名／商城寵物一隻</div><div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>本人堅持送</div></div>;
  if (rank >= 15 && rank <= 19) return <div style={{ fontWeight: 'bold', color: '#0284c7' }}>🏅 第十六~二十名／雪花 50</div>;
  return <div style={{ fontWeight: 'bold', color: '#64748b' }}>🎗️ 努力參賽獎</div>;
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
  const [deviceType, setDeviceType] = useState('pc'); 
  const [cropPreviewUrl, setCropPreviewUrl] = useState(''); 
  
  const [players, setPlayers] = useState([]);
  const [history, setHistory] = useState([]);
  const [msg, setMsg] = useState('');
  const [charNotice, setCharNotice] = useState('');
  const [isManualEdited, setIsManualEdited] = useState(false);
  const [idMismatch, setIdMismatch] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, isEnded: false });
  
  const fileInputRef = useRef(null);

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
      .eq('status', 'approved')
      .order('id', { ascending: true });

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
      if (user.pin !== pin) return setMsg('PIN 碼不正確！');
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

  // 🎯 底部狀態列精準鎖定
  function prepareCropImage(file, type) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          let cropX = 0, cropY = 0, cropWidth = img.width, cropHeight = img.height;

          if (type === 'mobile') {
            cropX = img.width * 0.25;
            cropY = img.height * 0.65;
            cropWidth = img.width * 0.50;
            cropHeight = img.height * 0.35;
          } else {
            cropX = 0;
            cropY = img.height * 0.65;
            cropWidth = img.width;
            cropHeight = img.height * 0.35;
          }

          canvas.width = cropWidth;
          canvas.height = cropHeight;
          ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
          
          const dataUrl = canvas.toDataURL('image/png', 1.0);
          setCropPreviewUrl(dataUrl);
          resolve(dataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleFileChange(e) {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setScanning(true);
    setCharNotice(`✅ 提交身分：【${loggedInUser}】（系統比對中...）`);
    setIsManualEdited(false);
    setIdMismatch(false);
    setLevel('');
    setExpVal('');
    setMsg(`⚡ 正在以關鍵字掃描${deviceType === 'mobile' ? '手機版下方狀態框' : '電腦版底部狀態列'}...`);

    try {
      const ocrImage = await prepareCropImage(selectedFile, deviceType);

      if (window.Tesseract) {
        const result = await window.Tesseract.recognize(ocrImage, 'chi_tra+eng');
        const rawText = result.data.text || '';

        // 🔍【偵錯印出】請按 F12 在主控台查看這裡印出的原始文字
        console.log("===== TESSERACT RAW TEXT =====");
        console.log(rawText);
        console.log("==============================");

        const cleanText = rawText.toUpperCase().replace(/\s+/g, '');
        console.log("===== CLEAN TEXT =====");
        console.log(cleanText);
        console.log("======================");

        // 1. ID 智慧比對
        const cleanLoggedUser = loggedInUser.trim().toUpperCase().replace(/\s+/g, '');
        const hasIdInText = cleanText.includes(cleanLoggedUser);
        
        if (!hasIdInText && cleanLoggedUser.length > 1) {
          setIdMismatch(true);
          setIsManualEdited(true);
          setCharNotice(`⚠️ 提示：在截圖底部未偵測到您的 ID【${loggedInUser}】，為確保公平，送出後將自動轉交管理員審核！`);
        } else {
          setCharNotice(`✅ 驗證通過：截圖與登入身分【${loggedInUser}】相符！`);
        }

        // 2. 🔑 等級抓取
        let foundLevel = '';
        const lvMatch = cleanText.match(/(?:LV|等級).{0,7}?(\d{3})/);
        if (lvMatch) {
          const lvNum = Number(lvMatch[1]);
          if (lvNum >= 120 && lvNum <= 200) {
            foundLevel = String(lvNum);
          }
        }

        if (!foundLevel) {
          const all3Digits = cleanText.match(/\d{3}/g);
          if (all3Digits) {
            const validLvs = all3Digits.map(Number).filter(n => n >= 120 && n <= 200);
            if (validLvs.length > 0) {
              foundLevel = String(validLvs[0]);
            }
          }
        }
        if (foundLevel) setLevel(foundLevel);

        // 3. 🔑 經驗值抓取
        let foundExp = '';
        const expMatch = cleanText.match(/EXP.{0,5}?(\d+)/);
        const percentMatch = cleanText.match(/(\d+)[\[\(]\d+\.?\d*%/);

        if (expMatch) {
          foundExp = expMatch[1];
        } else if (percentMatch) {
          foundExp = percentMatch[1];
        } else {
          const onlyNums = cleanText.replace(/[^0-9]/g, ' '); 
          const numArr = onlyNums.split(' ').filter(n => n.length > 0).map(Number);
          const validExps = numArr.filter(n => String(n) !== foundLevel);
          if (validExps.length > 0) {
            foundExp = String(Math.max(...validExps));
          }
        }
        if (foundExp) setExpVal(foundExp);

        setMsg('✨ 掃描解析完成！請檢查 F12 主控台與下方數值。');
      }
    } catch (err) {
      setMsg('圖片讀取完成，請手動填寫等級與經驗值。');
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

      const submissionStatus = (isManualEdited || idMismatch) ? 'pending_review' : 'approved';

      const { error: subError } = await supabase.from('submissions').insert([{
        char_id: loggedInUser.trim(),
        level: targetLevel,
        exp_val: inputExpNum,
        total_exp: 0, 
        photo_url: photoUrl,
        is_manual_edited: (isManualEdited || idMismatch),
        status: submissionStatus
      }]);

      if (subError) throw subError;

      if (submissionStatus === 'pending_review') {
        setMsg('🎉 成績已提交！因資料需人工覆核（或手動修改），目前已送交管理員審核中。');
      } else {
        setMsg('🎉 成績已成功自動提交！排行榜已為您解鎖並更新。');
      }
      
      setHasSubmitted(true);
      setIsManualEdited(false);
      setIdMismatch(false);
      setFile(null);
      setCropPreviewUrl('');
      if (fileInputRef.current) fileInputRef.current.value = ''; 
      
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
        <title>Artale Idotcat 夏日練等大賽 v3.41 (Debug)</title>
        <script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
      </Head>

      <h1 style={{ textAlign: 'center', color: '#1e293b', marginBottom: '5px' }}>🍁 Artale Idotcat 夏日練等大賽 (v3.41 Debug)</h1>
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
              💡 <strong>v3.41 偵錯版：</strong>已在主控台（F12）加入原始 OCR 文本印出，上傳後可直接對照檢查！
            </div>

            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>選擇截圖來源裝置：</label>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
              <label style={{ cursor: 'pointer', fontWeight: deviceType === 'pc' ? 'bold' : 'normal', color: deviceType === 'pc' ? '#2563eb' : '#334155' }}>
                <input type="radio" name="device" value="pc" checked={deviceType === 'pc'} onChange={() => setDeviceType('pc')} style={{ marginRight: '5px' }} />
                💻 電腦版截圖 (底部狀態列)
              </label>
              <label style={{ cursor: 'pointer', fontWeight: deviceType === 'mobile' ? 'bold' : 'normal', color: deviceType === 'mobile' ? '#2563eb' : '#334155' }}>
                <input type="radio" name="device" value="mobile" checked={deviceType === 'mobile'} onChange={() => setDeviceType('mobile')} style={{ marginRight: '5px' }} />
                📱 手機版截圖 (下方中央狀態框)
              </label>
            </div>

            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>1. 上傳證明截圖：</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'block', margin: '5px 0 10px 0' }} />
            
            {scanning && <p style={{ color: '#d97706', fontSize: '14px', fontWeight: 'bold' }}>⚡ 正在以關鍵字解析狀態列中...</p>}
            
            {cropPreviewUrl && (
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '8px', margin: '12px 0', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>
                  🔍 【底部狀態列裁切預覽】：
                </div>
                <img src={cropPreviewUrl} alt="Crop Preview" style={{ maxWidth: '100%', maxHeight: '160px', border: '2px solid #94a3b8', borderRadius: '4px', objectFit: 'contain' }} />
              </div>
            )}

            {charNotice && (
              <div style={{ background: idMismatch ? '#fef2f2' : '#f0fdf4', border: '1px solid ' + (idMismatch ? '#fecaca' : '#bbf7d0'), color: idMismatch ? '#991b1b' : '#15803d', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', margin: '8px 0' }}>
                {charNotice}
              </div>
            )}

            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', marginTop: '15px' }}>2. 當前等級 (Lv)：</label>
            <input 
              type="number" 
              placeholder="例如：179" 
              value={level} 
              onChange={e => { setLevel(e.target.value); setIsManualEdited(true); }} 
              style={{ display: 'block', margin: '5px 0 15px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid ' + (isManualEdited ? '#f59e0b' : '#cbd5e1'), boxSizing: 'border-box' }} 
            />

            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>3. 當前經驗值數字 (EXP)：</label>
            <input 
              type="number" 
              placeholder="例如：352627350" 
              value={expVal} 
              onChange={e => { setExpVal(e.target.value); setIsManualEdited(true); }} 
              style={{ display: 'block', margin: '5px 0 15px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid ' + (isManualEdited ? '#f59e0b' : '#cbd5e1'), boxSizing: 'border-box' }} 
            />
            {isManualEdited && <p style={{ color: '#d97706', fontSize: '12px', margin: '-10px 0 15px 0' }}>⚠️ 偵測到手動修改或 ID 需人工核對，送出後將自動進入管理員審核佇列。</p>}

            <button type="submit" disabled={loading} style={{ padding: '12px 24px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', width: '100%' }}>
              {loading ? '提交中...' : '確認並提交成績'}
            </button>
          </form>

          {/* 📈 角色經驗值走勢圖 */}
          <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1e293b' }}>📈 【{loggedInUser}】的經驗值成長走勢</h3>
            {history.length < 2 ? (
              <p style={{ color: '#64748b', fontSize: '14px' }}>目前歷史紀錄不足（需要至少提交 2 次通過審核的成績，才會生成成長折線圖喔！）</p>
            ) : (
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <svg width="100%" height="180" viewBox="0 0 500 180" style={{ background: '#f8fafc', borderRadius: '8px' }}>
                  {(() => {
                    const maxExp = Math.max(...history.map(h => h.exp_val || 0));
                    const minExp = Math.min(...history.map(h => h.exp_val || 0));
                    const expRange = (maxExp - minExp) || 1;
                    
                    const points = history.map((h, index) => {
                      const x = 40 + (index / (history.length - 1)) * 420;
                      const y = 140 - (((h.exp_val || 0) - minExp) / expRange) * 100;
                      return `${x},${y}`;
                    }).join(' ');

                    return (
                      <>
                        <polyline fill="none" stroke="#2563eb" strokeWidth="3" points={points} />
                        {history.map((h, index) => {
                          const x = 40 + (index / (history.length - 1)) * 420;
                          const y = 140 - (((h.exp_val || 0) - minExp) / expRange) * 100;
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
                <th style={{ padding: '12px 8px', width: '12%' }}>名次</th>
                <th style={{ padding: '12px 8px', width: '22%' }}>角色名稱</th>
                <th style={{ padding: '12px 8px', width: '12%' }}>當前等級</th>
                <th style={{ padding: '12px 8px', width: '18%' }}>累積成長經驗值</th>
                <th style={{ padding: '12px 8px', width: '24%' }}>對應獎品</th>
                <th style={{ padding: '12px 8px', width: '12%' }}>更新時間</th>
              </tr>
            </thead>
            <tbody>
              {players.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>目前尚無比賽數據或等待審核中</td></tr>
              ) : (
                players.map((p, idx) => {
                  const timeStr = p.created_at ? new Date(p.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '無時間紀錄';
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 'bold', color: idx === 0 ? '#d97706' : idx === 1 ? '#64748b' : idx === 2 ? '#b45309' : '#334155' }}>
                        {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 'bold', color: '#0f172a', maxWidth: '140px', wordBreak: 'break-all', fontSize: '13px', lineHeight: '1.3' }}>
                        {p.char_id}
                      </td>
                      <td style={{ padding: '12px 8px' }}>Lv.{p.level}</td>
                      <td style={{ padding: '12px 8px', color: '#16a34a', fontWeight: 'bold' }}>
                        +{Number(p.growth_exp).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '13px' }}>
                        {renderPrizeCell(idx)}
                      </td>
                      <td style={{ padding: '12px 8px', color: '#64748b', fontSize: '12px' }}>⏱️ {timeStr}</td>
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
