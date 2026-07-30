import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

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

export default function AdminPage() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [msg, setMsg] = useState('');
  const [activeTab, setActiveTab] = useState('submissions'); 

  function handleAdminLogin(e) {
    e.preventDefault();
    if (adminPassword === '0' && adminName.trim() !== '') {
      setIsAdminLoggedIn(true);
      setMsg(`歡迎管理員 【${adminName}】 登入後台！`);
      fetchSubmissions();
      fetchParticipants();
    } else {
      setMsg('登入失敗：請輸入管理員名稱，且密碼必須為 0！');
    }
  }

  async function fetchSubmissions() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .order('id', { ascending: false });

    if (!error) setSubmissions(data || []);
  }

  async function fetchParticipants() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .order('char_id', { ascending: true });

    if (!error) setParticipants(data || []);
  }

  // 🛡️ 切換核對狀態 (勾選/取消核對，並記錄當前管理員名稱)
  async function toggleCheckStatus(sub, isChecked) {
    if (!supabase) return;
    const checkedBy = isChecked ? adminName : null;

    const { error } = await supabase
      .from('submissions')
      .update({ checked_by: checkedBy })
      .eq('id', sub.id);

    if (!error) {
      setMsg(`📝 紀錄 #${sub.id} 核對狀態已更新`);
      fetchSubmissions();
    } else {
      setMsg('更新核對狀態失敗：' + error.message);
    }
  }

  async function updateStatus(id, newStatus) {
    if (!supabase) return;
    const { error } = await supabase.from('submissions').update({ status: newStatus }).eq('id', id);
    if (!error) {
      setMsg(`✅ 已成功將紀錄 #${id} 狀態更新為 ${newStatus}`);
      fetchSubmissions();
    } else setMsg('更新狀態失敗：' + error.message);
  }

  async function deleteSubmission(id) {
    if (!window.confirm(`確定要刪除提交紀錄 #${id} 嗎？此動作無法復原。`)) return;
    if (!supabase) return;
    const { error } = await supabase.from('submissions').delete().eq('id', id);
    if (!error) {
      setMsg(`🗑️ 已成功刪除紀錄 #${id}`);
      fetchSubmissions();
    } else setMsg('刪除失敗：' + error.message);
  }

  async function handleEditSubmission(sub) {
    const newLvStr = window.prompt(`修改紀錄 #${sub.id} 的「等級」：`, sub.level);
    if (newLvStr === null || newLvStr.trim() === '') return;
    const newExpStr = window.prompt(`修改紀錄 #${sub.id} 的「經驗值 (EXP)」：`, sub.exp_val);
    if (newExpStr === null || newExpStr.trim() === '') return;

    const newLv = Number(newLvStr);
    const newExp = Number(newExpStr);
    const newTotal = getCumulativeExp(newLv) + newExp;

    const { error } = await supabase.from('submissions').update({
      level: newLv, 
      exp_val: newExp, 
      total_exp: newTotal, 
      is_manually_edited: false,
      checked_by: adminName // 管理員修改後自動標記已核對
    }).eq('id', sub.id);

    if (!error) {
      setMsg(`🔧 紀錄 #${sub.id} 數值修改成功並標記已核對！`);
      fetchSubmissions();
    } else setMsg('修改失敗：' + error.message);
  }

  async function handleEditPin(charId, currentPin) {
    const newPin = window.prompt(`請輸入玩家 【${charId}】 的新 4 位數 PIN 碼：`, currentPin);
    if (newPin && newPin !== currentPin) {
      const { error } = await supabase.from('participants').update({ pin: newPin }).eq('char_id', charId);
      if (!error) { 
        setMsg(`🔑 玩家 【${charId}】 的 PIN 碼已強制修改成功！`); 
        fetchParticipants(); 
      } else setMsg('修改失敗：' + error.message);
    }
  }

  async function handleEditCharId(oldCharId) {
    const newCharId = window.prompt(`請輸入玩家 【${oldCharId}】 的新角色名稱：`, oldCharId);
    if (newCharId && newCharId.trim() !== '' && newCharId !== oldCharId) {
      const { data } = await supabase.from('participants').select('*').eq('char_id', newCharId).single();
      if (data) return alert('⚠️ 該角色名稱已有人使用！');
      
      await supabase.from('participants').update({ char_id: newCharId }).eq('char_id', oldCharId);
      await supabase.from('submissions').update({ char_id: newCharId }).eq('char_id', oldCharId);
      
      setMsg(`🔄 玩家名稱已成功從 【${oldCharId}】 更改為 【${newCharId}】！`);
      fetchParticipants(); 
      fetchSubmissions();
    }
  }

  return (
    <div style={{ maxWidth: '1250px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <Head>
        <title>Artale 夏日練等大賽 - 管理員審核後台</title>
      </Head>

      <h1 style={{ textAlign: 'center', color: '#1e293b' }}>🛡️ 練等大賽 - 管理員審核後台</h1>

      {msg && <div style={{ background: '#3b82f6', color: '#fff', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontWeight: 'bold' }}>{msg}</div>}

      {!isAdminLoggedIn ? (
        <form onSubmit={handleAdminLogin} style={{ background: '#f8fafc', padding: '30px', borderRadius: '12px', border: '1px solid #e2e8f0', maxWidth: '400px', margin: '50px auto' }}>
          <h3>🔐 管理員身分驗證</h3>
          <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>管理員帳號 (名稱)：</label>
          <input 
            type="text" 
            placeholder="請輸入您的管理員帳號" 
            value={adminName} 
            onChange={e => setAdminName(e.target.value)} 
            style={{ display: 'block', margin: '5px 0 15px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
          />
          <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>管理員密碼：</label>
          <input 
            type="password" 
            placeholder="密碼請輸入 0" 
            value={adminPassword} 
            onChange={e => setAdminPassword(e.target.value)} 
            style={{ display: 'block', margin: '5px 0 20px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
          />
          <button type="submit" style={{ padding: '10px 20px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>登入後台</button>
        </form>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', background: '#f1f5f9', padding: '15px', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontSize: '16px' }}>管理員帳號：<strong style={{ color: '#0369a1' }}>{adminName}</strong></p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => setActiveTab('submissions')} 
                style={{ padding: '8px 16px', background: activeTab === 'submissions' ? '#0f172a' : '#cbd5e1', color: activeTab === 'submissions' ? '#fff' : '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                📋 審核成績管理
              </button>
              <button 
                onClick={() => setActiveTab('users')} 
                style={{ padding: '8px 16px', background: activeTab === 'users' ? '#0f172a' : '#cbd5e1', color: activeTab === 'users' ? '#fff' : '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                👥 玩家帳號管理
              </button>
            </div>
          </div>

          {/* ================= 審核成績管理分頁 ================= */}
          {activeTab === 'submissions' && (
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#1e293b' }}>📋 玩家提交紀錄 (共 {submissions.length} 筆)</h3>
                <button onClick={fetchSubmissions} style={{ padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>🔄 重新整理</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '1050px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px' }}>ID</th>
                    <th style={{ padding: '10px' }}>角色名稱</th>
                    <th style={{ padding: '10px' }}>等級</th>
                    <th style={{ padding: '10px' }}>經驗值 (EXP)</th>
                    <th style={{ padding: '10px' }}>標記狀態</th>
                    <th style={{ padding: '10px' }}>管理員核對狀態</th>
                    <th style={{ padding: '10px' }}>審核狀態</th>
                    <th style={{ padding: '10px' }}>截圖證明</th>
                    <th style={{ padding: '10px' }}>提交時間</th>
                    <th style={{ padding: '10px' }}>管理動作</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.length === 0 ? (
                    <tr><td colSpan="10" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>尚無紀錄</td></tr>
                  ) : (
                    submissions.map((sub) => {
                      const timeStr = sub.created_at ? new Date(sub.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '無時間';
                      const isChecked = Boolean(sub.checked_by);

                      return (
                        <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9', background: sub.is_manually_edited ? '#fffbeb' : 'transparent' }}>
                          <td style={{ padding: '10px', fontWeight: 'bold' }}>#{sub.id}</td>
                          <td style={{ padding: '10px', fontWeight: 'bold', color: '#0f172a' }}>{sub.char_id}</td>
                          <td style={{ padding: '10px' }}>Lv.{sub.level}</td>
                          <td style={{ padding: '10px' }}>{Number(sub.exp_val || 0).toLocaleString()}</td>
                          <td style={{ padding: '10px' }}>
                            {sub.is_manually_edited ? (
                              <span style={{ color: '#d97706', fontWeight: 'bold', background: '#fef3c7', padding: '4px 8px', borderRadius: '4px' }}>⚠️ 手動修改</span>
                            ) : (
                              <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✅ 自動辨識</span>
                            )}
                          </td>
                          {/* 🛡️ 新增：管理員核對勾選與顯示核對帳號 */}
                          <td style={{ padding: '10px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                              <input 
                                type="checkbox" 
                                checked={isChecked} 
                                onChange={(e) => toggleCheckStatus(sub, e.target.checked)} 
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                              {isChecked ? (
                                <span style={{ color: '#0284c7', fontSize: '12px' }}>✅ 已核對：{sub.checked_by}</span>
                              ) : (
                                <span style={{ color: '#dc2626', fontSize: '12px' }}>❌ 未核對</span>
                              )}
                            </label>
                          </td>
                          <td style={{ padding: '10px' }}>
                            <span style={{ color: sub.status === 'approved' ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
                              {sub.status === 'approved' ? '🟢 已通過' : '🔴 已拒絕'}
                            </span>
                          </td>
                          <td style={{ padding: '10px' }}>
                            {sub.photo_url ? (
                              <a href={sub.photo_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 'bold' }}>🔍 檢視截圖</a>
                            ) : '無截圖'}
                          </td>
                          <td style={{ padding: '10px', color: '#64748b' }}>{timeStr}</td>
                          <td style={{ padding: '10px' }}>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {sub.status === 'approved' ? (
                                <button onClick={() => updateStatus(sub.id, 'rejected')} style={{ padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>拒絕</button>
                              ) : (
                                <button onClick={() => updateStatus(sub.id, 'approved')} style={{ padding: '4px 8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>通過</button>
                              )}
                              <button onClick={() => handleEditSubmission(sub)} style={{ padding: '4px 8px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✏️ 改數據</button>
                              <button onClick={() => deleteSubmission(sub.id)} style={{ padding: '4px 8px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>🗑️ 刪除</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ================= 玩家帳號管理分頁 ================= */}
          {activeTab === 'users' && (
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#1e293b' }}>👥 註冊玩家列表 (共 {participants.length} 人)</h3>
                <button onClick={fetchParticipants} style={{ padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>🔄 重新整理</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', minWidth: '600px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px' }}>角色名稱 (ID)</th>
                    <th style={{ padding: '12px' }}>設定的 PIN 碼</th>
                    <th style={{ padding: '12px' }}>註冊時間</th>
                    <th style={{ padding: '12px' }}>強制管理動作</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.length === 0 ? (
                    <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>目前無註冊玩家</td></tr>
                  ) : (
                    participants.map((user) => {
                      const timeStr = user.created_at ? new Date(user.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '無時間';
                      return (
                        <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold', color: '#0f172a' }}>{user.char_id}</td>
                          <td style={{ padding: '12px', color: '#b91c1c', fontWeight: 'bold', letterSpacing: '2px' }}>{user.pin}</td>
                          <td style={{ padding: '12px', color: '#64748b' }}>{timeStr}</td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => handleEditCharId(user.char_id)} style={{ padding: '6px 12px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✏️ 強制改名</button>
                              <button onClick={() => handleEditPin(user.char_id, user.pin)} style={{ padding: '6px 12px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🔑 強制改PIN</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
