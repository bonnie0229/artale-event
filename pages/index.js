import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// 🔒 預設幹部管理員密碼
const ADMIN_PASSWORD = '8888';

// 🍁 1~200 級經驗值對照表
function getExpRequiredForLevel(lv) {
  if (lv <= 1) return 15;
  if (lv <= 15) return Math.floor(15 * Math.pow(1.3, lv - 1));
  if (lv <= 30) return Math.floor(1000 * Math.pow(1.2, lv - 15));
  if (lv <= 70) return Math.floor(15000 * Math.pow(1.15, lv - 30));
  if (lv <= 120) return Math.floor(200000 * Math.pow(1.1, lv - 70));
  if (lv <= 200) return Math.floor(5000000 * Math.pow(1.08, lv - 120));
  return 1000000000;
}

function getCumulativeExp(lv) {
  let total = 0;
  for (let i = 1; i < lv; i++) {
    total += getExpRequiredForLevel(i);
  }
  return total;
}

export default function Admin() {
  const [adminPass, setAdminPass] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [msg, setMsg] = useState('');
  
  // 編輯模式狀態
  const [editingSub, setEditingSub] = useState(null);
  const [editLevel, setEditLevel] = useState('');
  const [editExp, setEditExp] = useState('');

  // 重設密碼狀態
  const [resetName, setResetName] = useState('');
  const [resetPin, setResetPin] = useState('0000');

  useEffect(() => {
    if (isAdminLoggedIn) {
      fetchAllData();
    }
  }, [isAdminLoggedIn]);

  async function fetchAllData() {
    if (!supabase) return;
    
    const { data: subs } = await supabase
      .from('submissions')
      .select('*')
      .order('id', { ascending: false });

    if (subs) setSubmissions(subs);

    const { data: parts } = await supabase
      .from('participants')
      .select('*')
      .order('id', { ascending: false });

    if (parts) setParticipants(parts);
  }

  function handleAdminLogin(e) {
    e.preventDefault();
    if (adminPass === ADMIN_PASSWORD) {
      setIsAdminLoggedIn(true);
      setMsg('登入成功！歡迎幹部小幫手使用管理後台');
    } else {
      setMsg('❌ 管理員密碼錯誤！');
    }
  }

  // 🗑️ 刪除單筆成績紀錄 (不影響該玩家其他紀錄)
  async function handleDeleteSubmission(subId) {
    if (!confirm(`確定要刪除紀錄 #${subId} 嗎？（刪除後系統會自動補上上一筆合規紀錄）`)) return;
    const { error } = await supabase.from('submissions').delete().eq('id', subId);
    if (error) {
      setMsg('刪除失敗：' + error.message);
    } else {
      setMsg(`已成功刪除紀錄 #${subId}！排行榜已自動重新計算。`);
      fetchAllData();
    }
  }

  // ✏️ 開啟微調修改視窗
  function handleStartEdit(sub) {
    setEditingSub(sub);
    setEditLevel(sub.level);
    setEditExp(sub.exp_val);
  }

  // 💾 儲存微調後的數字
  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingSub) return;

    const newLv = Number(editLevel);
    const newExp = Number(editExp);
    const calculatedTotalExp = getCumulativeExp(newLv) + newExp;

    const { error } = await supabase
      .from('submissions')
      .update({
        level: newLv,
        exp_val: newExp,
        total_exp: calculatedTotalExp
      })
      .eq('id', editingSub.id);

    if (error) {
      setMsg('修改失敗：' + error.message);
    } else {
      setMsg(`🎉 成功修改紀錄 #${editingSub.id} 的成績！`);
      setEditingSub(null);
      fetchAllData();
    }
  }

  // 🧹 徹底刪除整個玩家帳號及其所有數據
  async function handleDeletePlayer(charId) {
    if (!confirm(`⚠️ 警告：確定要徹底清除【${charId}】玩家帳號及其「所有歷史成績紀錄」嗎？此操作無法復原！`)) return;
    
    await supabase.from('submissions').delete().eq('char_id', charId);
    const { error } = await supabase.from('participants').delete().eq('char_id', charId);

    if (error) {
      setMsg('刪除玩家失敗：' + error.message);
    } else {
      setMsg(`已徹底刪除玩家【${charId}】及其所有歷史成績！`);
      fetchAllData();
    }
  }

  // 🔑 幫忘記 PIN 碼的玩家重設密碼
  async function handleResetUserPin(e) {
    e.preventDefault();
    if (!resetName || !resetPin) return setMsg('請填寫完整資訊');

    const { error } = await supabase
      .from('participants')
      .update({ pin: resetPin })
      .eq('char_id', resetName.trim());

    if (error) {
      setMsg('重設失敗：' + error.message);
    } else {
      setMsg(`🎉 成功幫【${resetName}】的 PIN 碼重設為【${resetPin}】！`);
      setResetName('');
      fetchAllData();
    }
  }

  // 📊 匯出排行榜 CSV 檔 (結算發獎用)
  function handleExportCSV() {
    if (submissions.length === 0) return alert('目前尚無成績可匯出');

    const userGroup = {};
    submissions.slice().reverse().forEach(sub => {
      const cleanName = (sub.char_id || '').trim();
      if (!cleanName) return;
      if (!userGroup[cleanName]) userGroup[cleanName] = [];
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
        growth_exp: expGrowth >= 0 ? expGrowth : 0,
        submission_count: subs.length,
        last_update: latest.created_at
      };
    });

    list.sort((a, b) => b.growth_exp - a.growth_exp);

    let csvContent = '\uFEFF名次,角色名稱,當前等級,累積成長經驗值,回報次數,最後更新時間\n';
    list.forEach((p, idx) => {
      csvContent += `${idx + 1},"${p.char_id}",Lv.${p.level},${p.growth_exp},${p.submission_count},"${new Date(p.last_update).toLocaleString('zh-TW')}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Artale練等大賽結算表_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 篩選列表
  const filteredSubmissions = submissions.filter(s => 
    s.char_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <Head>
        <title>iDotCat 幹部管理後台</title>
      </Head>

      <h1 style={{ textAlign: 'center', color: '#991b1b' }}>👑 iDotCat 夏日練等大賽 - 幹部管理後台</h1>

      {msg && <div style={{ background: '#3b82f6', color: '#fff', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontWeight: 'bold' }}>{msg}</div>}

      {!isAdminLoggedIn ? (
        <form onSubmit={handleAdminLogin} style={{ maxWidth: '400px', margin: '50px auto', background: '#f8fafc', padding: '30px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
          <h3>🔑 幹部管理員登入</h3>
          <input 
            type="password" 
            placeholder="請輸入管理員密碼 (預設: 8888)" 
            value={adminPass} 
            onChange={e => setAdminPass(e.target.value)} 
            style={{ display: 'block', margin: '15px 0', padding: '12px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
          />
          <button type="submit" style={{ padding: '12px 24px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>登入管理後台</button>
        </form>
      ) : (
        <div>
          {/* 工具按鈕與搜尋欄 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <input 
              type="text" 
              placeholder="🔍 搜尋特定角色 ID..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              style={{ padding: '10px', width: '250px', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
            />

            <button onClick={handleExportCSV} style={{ padding: '10px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              📊 匯出排行榜 Excel/CSV 報表
            </button>
          </div>

          {/* 編輯跳窗 */}
          {editingSub && (
            <form onSubmit={handleSaveEdit} style={{ background: '#f0f9ff', border: '2px solid #0284c7', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#0369a1' }}>✏️ 微調修改成績紀錄 #{editingSub.id} (角色：{editingSub.char_id})</h3>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontWeight: 'bold' }}>等級 (LV)：</label>
                  <input type="number" value={editLevel} onChange={e => setEditLevel(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', display: 'block', marginTop: '5px' }} />
                </div>
                <div>
                  <label style={{ fontWeight: 'bold' }}>經驗值 (EXP)：</label>
                  <input type="number" value={editExp} onChange={e => setEditExp(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', display: 'block', marginTop: '5px', width: '220px' }} />
                </div>
              </div>
              <button type="submit" style={{ padding: '8px 16px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginRight: '10px' }}>儲存修改</button>
              <button type="button" onClick={() => setEditingSub(null)} style={{ padding: '8px 16px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>取消</button>
            </form>
          )}

          {/* 重設玩家 PIN 碼功能 */}
          <div style={{ background: '#fffbe0', padding: '15px 20px', borderRadius: '12px', border: '1px solid #fef08a', marginBottom: '25px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#854d0e' }}>🔑 協助公會成員重設 PIN 碼</h4>
            <form onSubmit={handleResetUserPin} style={{ display: 'flex', gap: '10px' }}>
              <input type="text" placeholder="玩家角色 ID" value={resetName} onChange={e => setResetName(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              <input type="text" placeholder="新 4 位數 PIN" value={resetPin} onChange={e => setResetPin(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              <button type="submit" style={{ padding: '8px 16px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>重設 PIN 碼</button>
            </form>
          </div>

          {/* 所有玩家提交紀錄與原始照片 */}
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3>📸 玩家上傳截圖與成績列表 (共 {filteredSubmissions.length} 筆)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', color: '#475569' }}>
                    <th style={{ padding: '10px' }}>ID</th>
                    <th style={{ padding: '10px' }}>角色名稱</th>
                    <th style={{ padding: '10px' }}>等級</th>
                    <th style={{ padding: '10px' }}>經驗值</th>
                    <th style={{ padding: '10px' }}>對應原始截圖</th>
                    <th style={{ padding: '10px' }}>提交時間</th>
                    <th style={{ padding: '10px' }}>管理操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map((sub) => {
                    const timeStr = sub.created_at ? new Date(sub.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '';
                    return (
                      <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px', color: '#64748b' }}>#{sub.id}</td>
                        <td style={{ padding: '10px', fontWeight: 'bold', color: '#0f172a' }}>{sub.char_id}</td>
                        <td style={{ padding: '10px' }}>Lv.{sub.level}</td>
                        <td style={{ padding: '10px' }}>{Number(sub.exp_val).toLocaleString()}</td>
                        <td style={{ padding: '10px' }}>
                          {sub.photo_url ? (
                            <a href={sub.photo_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 'bold' }}>📸 看照片</a>
                          ) : '無'}
                        </td>
                        <td style={{ padding: '10px', fontSize: '13px', color: '#64748b' }}>{timeStr}</td>
                        <td style={{ padding: '10px' }}>
                          <button onClick={() => handleStartEdit(sub)} style={{ padding: '4px 8px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '6px' }}>微調修改</button>
                          <button onClick={() => handleDeleteSubmission(sub.id)} style={{ padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '6px' }}>單筆刪除</button>
                          <button onClick={() => handleDeletePlayer(sub.char_id)} style={{ padding: '4px 8px', background: '#475569', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>清空該帳號</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
