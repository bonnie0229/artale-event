import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export default function AdminPage() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [msg, setMsg] = useState('');

  // 簡易管理員密碼（您可以自行修改這組密碼）
  const ADMIN_SECRET = 'artale999';

  function handleAdminLogin(e) {
    e.preventDefault();
    if (adminPassword === ADMIN_SECRET) {
      setIsAdminLoggedIn(true);
      setMsg('管理員登入成功！');
      fetchSubmissions();
    } else {
      setMsg('管理員密碼錯誤！');
    }
  }

  async function fetchSubmissions() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      setMsg('獲取資料失敗：' + error.message);
    } else {
      setSubmissions(data || []);
    }
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <Head>
        <title>Artale 夏日練等大賽 - 管理員審核後台</title>
      </Head>

      <h1 style={{ textAlign: 'center', color: '#1e293b' }}>🛡️ 練等大賽管理員審核後台</h1>

      {msg && <div style={{ background: '#3b82f6', color: '#fff', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontWeight: 'bold' }}>{msg}</div>}

      {!isAdminLoggedIn ? (
        <form onSubmit={handleAdminLogin} style={{ background: '#f8fafc', padding: '30px', borderRadius: '12px', border: '1px solid #e2e8f0', maxWidth: '400px', margin: '50px auto' }}>
          <h3>🔐 管理員身分驗證</h3>
          <input 
            type="password" 
            placeholder="請輸入管理員密碼" 
            value={adminPassword} 
            onChange={e => setAdminPassword(e.target.value)} 
            style={{ display: 'block', margin: '15px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
          />
          <button type="submit" style={{ padding: '10px 20px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>登入後台</button>
        </form>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <p style={{ margin: 0, fontSize: '16px' }}>總提交紀錄筆數：<strong>{submissions.length}</strong> 筆</p>
            <button onClick={fetchSubmissions} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🔄 重新整理資料</button>
          </div>

          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '800px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '10px' }}>ID</th>
                  <th style={{ padding: '10px' }}>角色名稱</th>
                  <th style={{ padding: '10px' }}>等級</th>
                  <th style={{ padding: '10px' }}>經驗值 (EXP)</th>
                  <th style={{ padding: '10px' }}>審核狀態 / 備註</th>
                  <th style={{ padding: '10px' }}>截圖證明</th>
                  <th style={{ padding: '10px' }}>提交時間</th>
                </tr>
              </thead>
              <tbody>
                {submissions.length === 0 ? (
                  <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>目前尚無任何提交紀錄</td></tr>
                ) : (
                  submissions.map((sub) => {
                    const timeStr = sub.created_at ? new Date(sub.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '無時間';
                    return (
                      <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9', background: sub.is_manually_edited ? '#fffbeb' : 'transparent' }}>
                        <td style={{ padding: '10px', fontWeight: 'bold' }}>#{sub.id}</td>
                        <td style={{ padding: '10px', fontWeight: 'bold', color: '#0f172a' }}>{sub.char_id}</td>
                        <td style={{ padding: '10px' }}>Lv.{sub.level}</td>
                        <td style={{ padding: '10px' }}>{Number(sub.exp_val || 0).toLocaleString()}</td>
                        <td style={{ padding: '10px' }}>
                          {sub.is_manually_edited ? (
                            <span style={{ color: '#d97706', fontWeight: 'bold', background: '#fef3c7', padding: '4px 8px', borderRadius: '4px' }}>
                              ⚠️ 需人工審核 (手動修改)
                            </span>
                          ) : (
                            <span style={{ color: '#16a34a', fontWeight: 'bold' }}>
                              ✅ 自動辨識
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px' }}>
                          {sub.photo_url ? (
                            <a href={sub.photo_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 'bold' }}>🔍 檢視截圖原圖</a>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>無截圖</span>
                          )}
                        </td>
                        <td style={{ padding: '10px', color: '#64748b' }}>{timeStr}</td>
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
