import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// 🍁 經驗值對照表與計算函數（與前台完全同步）
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

export default function Admin() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [msg, setMsg] = useState('');

  // 編輯狀態
  const [editingId, setEditingId] = useState(null);
  const [editLevel, setEditLevel] = useState('');
  const [editExp, setEditExp] = useState('');

  useEffect(() => {
    const savedAdmin = localStorage.getItem('artale_admin');
    if (savedAdmin === 'true') {
      setIsAdminLoggedIn(true);
      fetchAllData();
    }
  }, []);

  async function fetchAllData() {
    if (!supabase) return;
    const { data, error } = await supabase.from('submissions').select('*').order('created_at', { ascending: true });
    if (error) {
      setMsg('載入資料失敗：' + error.message);
      return;
    }
    if (data) {
      setSubmissions(data);
      calculateLeaderboard(data);
    }
  }

  function calculateLeaderboard(data) {
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
        submission_count: subs.length,
        last_updated: latest.created_at
      };
    });

    list.sort((a, b) => b.growth_exp - a.growth_exp);
    setLeaderboard(list);
  }

  function handleLogin(e) {
    e.preventDefault();
    if (username === 'idotcat' && password === '0411') {
      setIsAdminLoggedIn(true);
      localStorage.setItem('artale_admin', 'true');
      setMsg('幹部登入成功！');
      fetchAllData();
    } else {
      setMsg('幹部帳號或密碼錯誤！');
    }
  }

  function handleLogout() {
    localStorage.removeItem('artale_admin');
    setIsAdminLoggedIn(false);
    setUsername('');
    setPassword('');
    setMsg('已成功登出幹部後台');
  }

  async function handleDeleteSub(id, photoUrl) {
    if (!confirm('確定要刪除這筆提交紀錄嗎？')) return;
    if (!supabase) return;

    if (photoUrl) {
      try {
        const urlObj = new URL(photoUrl);
        const pathParts = urlObj.pathname.split('/');
        const fileName = pathParts[pathParts.length - 1];
        if (fileName) {
          await supabase.storage.from('screenshots').remove([fileName]);
        }
      } catch (e) {
        console.error('刪除圖片失敗:', e);
      }
    }

    const { error } = await supabase.from('submissions').delete().eq('id', id);
    if (error) {
      setMsg('刪除失敗：' + error.message);
    } else {
      setMsg('已成功刪除該筆紀錄！');
      fetchAllData();
    }
  }

  async function handleDeleteUser(charId) {
    if (!confirm(`⚠️ 確定要【徹底清除】玩家【${charId}】的所有資料（含所有截圖與註冊帳號）嗎？此動作無法復原！`)) return;
    if (!supabase) return;

    const { error: subErr } = await supabase.from('submissions').delete().eq('char_id', charId);
    if (subErr) return setMsg('刪除成績失敗：' + subErr.message);

    const { error: partErr } = await supabase.from('participants').delete().eq('char_id', charId);
    if (partErr) return setMsg('刪除參賽者檔案失敗：' + partErr.message);

    setMsg(`🎉 已徹底清除玩家【${charId}】的所有資料！`);
    fetchAllData();
  }

  async function handleResetPin(charId) {
    const newPin = prompt(`請輸入要為玩家【${charId}】重設的新 4 位數 PIN 碼：`);
    if (!newPin || newPin.length !== 4) {
      alert('PIN 碼必須是 4 位數字！');
      return;
    }
    if (!supabase) return;

    const { error } = await supabase.from('participants').update({ pin: newPin }).eq('char_id', charId);
    if (error) {
      alert('重設失敗：' + error.message);
    } else {
      alert(`🎉 玩家【${charId}】的 PIN 碼已成功重設為：${newPin}`);
    }
  }

  function startEdit(sub) {
    setEditingId(sub.id);
    setEditLevel(sub.level);
    setEditExp(sub.exp_val);
  }

  async function saveEdit(sub) {
    if (!supabase) return;
    const targetLevel = Number(editLevel);
    const inputExpNum = Number(editExp);
    const calculatedTotalExp = getCumulativeExp(targetLevel) + inputExpNum;

    const { error } = await supabase.from('submissions').update({
      level: targetLevel,
      exp_val: inputExpNum,
      total_exp: calculatedTotalExp
    }).eq('id', sub.id);

    if (error) {
      setMsg('修改失敗：' + error.message);
    } else {
      setMsg(`🎉 成功更新記錄 ID #${sub.id} 的成績！`);
      setEditingId(null);
      fetchAllData();
    }
  }

  function exportCSV() {
    if (leaderboard.length === 0) {
      alert('目前沒有排行榜資料可匯出！');
      return;
    }

    let csvContent = '\uFEFF名次,角色名稱,當前等級,累積成長經驗值,對應獎品,回報次數,最後更新時間\n';
    leaderboard.forEach((p, idx) => {
      const badge = getPrizeBadge(idx);
      csvContent += `${idx + 1},${p.char_id},Lv.${p.level},${p.growth_exp},${badge},${p.submission_count},${new Date(p.last_updated).toLocaleString('zh-TW')}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Artale_Summer_Event_Leaderboard_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const filteredSubmissions = submissions.filter(sub => 
    (sub.char_id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <Head>
        <title>Artale 夏日練等大賽 - 幹部後台</title>
      </Head>

      <h1 style={{ textAlign: 'center', color: '#1e293b', marginBottom: '5px' }}>👑 Artale 幹部管理後台</h1>
      
      {msg && <div style={{ background: '#3b82f6', color: '#fff', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontWeight: 'bold' }}>{msg}</div>}

      {!isAdminLoggedIn ? (
        <form onSubmit={handleLogin} style={{ background: '#f8fafc', padding: '30px', borderRadius: '12px', border: '1px solid #e2e8f0', maxWidth: '400px', margin: '40px auto' }}>
          <h3>🔑 幹部身分驗證</h3>
          <input type="text" placeholder="幹部帳號" value={username} onChange={e => setUsername(e.target.value)} style={{ display: 'block', margin: '10px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
          <input type="password" placeholder="幹部密碼" value={password} onChange={e => setPassword(e.target.value)} style={{ display: 'block', margin: '10px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
          <button type="submit" style={{ padding: '10px 20px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>登入後台</button>
        </form>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: 0 }}>📊 賽事管理總覽</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={exportCSV} style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>📥 匯出結算報表 (CSV)</button>
              <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>登出後台</button>
            </div>
          </div>

          {/* 🏆 即時排行榜結算預覽 */}
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
            <h3 style={{ marginTop: 0, color: '#1e293b' }}>🏆 當前排行榜總結算預覽</h3>
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px' }}>名次</th>
                    <th style={{ padding: '10px' }}>角色 ID</th>
                    <th style={{ padding: '10px' }}>當前等級</th>
                    <th style={{ padding: '10px' }}>累積成長 EXP</th>
                    <th style={{ padding: '10px' }}>對應獎品</th>
                    <th style={{ padding: '10px' }}>回報次數</th>
                    <th style={{ padding: '10px' }}>操作管理</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.length === 0 ? (
                    <tr><td colSpan="7" style={{ padding: '15px', textAlign: 'center', color: '#94a3b8' }}>目前尚無參賽者數據</td></tr>
                  ) : (
                    leaderboard.map((p, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px', fontWeight: 'bold' }}>{idx + 1}</td>
                        <td style={{ padding: '10px', fontWeight: 'bold', color: '#2563eb' }}>{p.char_id}</td>
                        <td style={{ padding: '10px' }}>Lv.{p.level}</td>
                        <td style={{ padding: '10px', color: '#16a34a', fontWeight: 'bold' }}>+{Number(p.growth_exp).toLocaleString()}</td>
                        <td style={{ padding: '10px', color: '#0284c7', fontWeight: 'bold' }}>{getPrizeBadge(idx)}</td>
                        <td style={{ padding: '10px' }}>{p.submission_count} 次</td>
                        <td style={{ padding: '10px' }}>
                          <button onClick={() => handleResetPin(p.char_id)} style={{ padding: '4px 8px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '6px', fontSize: '12px' }}>重設密碼</button>
                          <button onClick={() => handleDeleteUser(p.char_id)} style={{ padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>清除玩家</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 📋 所有提交紀錄審核 */}
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ margin: 0, color: '#1e293b' }}>📋 歷史提交紀錄與截圖審核</h3>
              <input type="text" placeholder="🔍 搜尋特定角色 ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '250px' }} />
            </div>

            <div style={{ width: '100%', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px' }}>ID</th>
                    <th style={{ padding: '10px' }}>角色名稱</th>
                    <th style={{ padding: '10px' }}>等級</th>
                    <th style={{ padding: '10px' }}>回報 EXP</th>
                    <th style={{ padding: '10px' }}>證明截圖</th>
                    <th style={{ padding: '10px' }}>提交時間</th>
                    <th style={{ padding: '10px' }}>管理操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.length === 0 ? (
                    <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>找不到符合的提交紀錄</td></tr>
                  ) : (
                    filteredSubmissions.map(sub => {
                      const isEditing = editingId === sub.id;
                      return (
                        <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px' }}>#{sub.id}</td>
                          <td style={{ padding: '10px', fontWeight: 'bold' }}>{sub.char_id}</td>
                          <td style={{ padding: '10px' }}>
                            {isEditing ? (
                              <input type="number" value={editLevel} onChange={e => setEditLevel(e.target.value)} style={{ width: '60px', padding: '4px' }} />
                            ) : (
                              `Lv.${sub.level}`
                            )}
                          </td>
                          <td style={{ padding: '10px' }}>
                            {isEditing ? (
                              <input type="number" value={editExp} onChange={e => setEditExp(e.target.value)} style={{ width: '120px', padding: '4px' }} />
                            ) : (
                              Number(sub.exp_val).toLocaleString()
                            )}
                          </td>
                          <td style={{ padding: '10px' }}>
                            {sub.photo_url ? (
                              <a href={sub.photo_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 'bold', textDecoration: 'underline' }}>📸 看照片</a>
                            ) : (
                              '無照片'
                            )}
                          </td>
                          <td style={{ padding: '10px', fontSize: '13px', color: '#64748b' }}>
                            {new Date(sub.created_at).toLocaleString('zh-TW')}
                          </td>
                          <td style={{ padding: '10px' }}>
                            {isEditing ? (
                              <>
                                <button onClick={() => saveEdit(sub)} style={{ padding: '4px 8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '4px', fontSize: '12px' }}>儲存</button>
                                <button onClick={() => setEditingId(null)} style={{ padding: '4px 8px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>取消</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEdit(sub)} style={{ padding: '4px 8px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '4px', fontSize: '12px' }}>微調</button>
                                <button onClick={() => handleDeleteSub(sub.id, sub.photo_url)} style={{ padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>刪除</button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
