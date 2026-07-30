import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// 🍁 Artale 120~200 級精準 1.05 倍對照
function getExpRequiredForLevel(lv) {
  if (lv < 120) return 0;
  return Math.floor(29715818 * Math.pow(1.05, lv - 120));
}

// 🎯 計算兩筆紀錄之間的成長量
function calculateExpBetween(prev, curr) {
  if (!prev || !curr) return 0;
  const baseLv = Number(prev.level);
  const baseExp = Number(prev.exp_val) || 0;
  const currLv = Number(curr.level);
  const currExp = Number(curr.exp_val) || 0;

  if (currLv === baseLv) return Math.max(0, currExp - baseExp);
  if (currLv < baseLv) return 0;

  let totalGrowth = 0;
  const baseLevelReq = getExpRequiredForLevel(baseLv);
  totalGrowth += Math.max(0, baseLevelReq - baseExp);

  for (let l = baseLv + 1; l < currLv && l <= 200; l++) {
    totalGrowth += getExpRequiredForLevel(l);
  }
  totalGrowth += currExp;
  return totalGrowth;
}

function calculateGrowthExp(baseline, latest) {
  return calculateExpBetween(baseline, latest);
}

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUser, setAdminUser] = useState('');
  const [password, setPassword] = useState('');
  const [playerSubmissions, setPlayerSubmissions] = useState([]);
  const [msg, setMsg] = useState('');

  // 🎯 帳號隨便打，密碼輸入 0 即可登入
  function handleAdminLogin(e) {
    e.preventDefault();
    if (password === '0') {
      setIsAdmin(true);
      setMsg('✅ 管理員登入成功！');
      fetchAllSubmissions();
    } else {
      setMsg('❌ 密碼錯誤！(請輸入 0)');
    }
  }

  async function fetchAllSubmissions() {
    if (!supabase) return;
    const { data, error } = await supabase.from('submissions').select('*').order('id', { ascending: true });
    if (error) {
      setMsg('❌ 讀取失敗：' + error.message);
      return;
    }

    if (data) {
      const userGroup = {};
      data.forEach(sub => {
        const cleanName = (sub.char_id || '').trim();
        if (!cleanName) return;
        if (!userGroup[cleanName]) userGroup[cleanName] = [];
        userGroup[cleanName].push(sub);
      });

      const formattedList = Object.keys(userGroup).map(id => {
        const subs = userGroup[id];
        subs.sort((a, b) => a.id - b.id);
        
        const baseline = subs[0];
        const latest = subs[subs.length - 1];
        const previous = subs.length > 1 ? subs[subs.length - 2] : null;

        const growthExp = calculateGrowthExp(baseline, latest);
        const thisTimeAddedExp = calculateExpBetween(previous, latest);

        return {
          char_id: id,
          baseline,
          previous,
          latest,
          growthExp,
          thisTimeAddedExp,
          totalSubmissions: subs.length
        };
      });

      formattedList.sort((a, b) => b.growthExp - a.growthExp);
      setPlayerSubmissions(formattedList);
    }
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <Head>
        <title>Artale 練等大賽 - 管理員審核後台</title>
      </Head>

      <h1 style={{ textAlign: 'center', color: '#1e293b' }}>🛡️ 練等大賽管理員審核後台</h1>

      {msg && <div style={{ background: '#3b82f6', color: '#fff', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontWeight: 'bold' }}>{msg}</div>}

      {!isAdmin ? (
        <form onSubmit={handleAdminLogin} style={{ background: '#f8fafc', padding: '30px', borderRadius: '12px', border: '1px solid #e2e8f0', maxWidth: '400px', margin: '40px auto' }}>
          <h3>🔐 管理員登入</h3>
          <input 
            type="text" 
            placeholder="管理員名稱 (隨便輸入)" 
            value={adminUser} 
            onChange={e => setAdminUser(e.target.value)} 
            style={{ display: 'block', margin: '15px 0 10px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
          />
          <input 
            type="password" 
            placeholder="密碼 (請輸入 0)" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            style={{ display: 'block', margin: '0 0 15px 0', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
          />
          <button type="submit" style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>登入後台</button>
        </form>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: '#0f172a' }}>📊 參賽玩家成長曲線與前後截圖審核</h2>
            <button onClick={fetchAllSubmissions} style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🔄 重新整理數據</button>
          </div>

          {playerSubmissions.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#64748b' }}>目前尚無玩家提交任何成績紀錄。</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {playerSubmissions.map((player, idx) => {
                const latestTime = player.latest.created_at ? new Date(player.latest.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '無時間';
                const prevTime = player.previous && player.previous.created_at ? new Date(player.previous.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '無';

                return (
                  <div key={idx} style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', marginBottom: '15px' }}>
                      <h3 style={{ margin: 0, color: '#2563eb' }}>
                        #{idx + 1} 角色：{player.char_id} <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 'normal' }}>(總提交次數：{player.totalSubmissions} 次)</span>
                      </h3>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ background: '#e0f2fe', color: '#0369a1', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', border: '1px solid #bae6fd' }}>
                          本次新增：+{Number(player.thisTimeAddedExp).toLocaleString()} EXP
                        </div>
                        <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', border: '1px solid #bbf7d0' }}>
                          累積總成長：+{Number(player.growthExp).toLocaleString()} EXP
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                      <div>
                        <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>⏮️ 上一次紀錄 ({prevTime})：</p>
                        {player.previous ? (
                          <p style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#334155' }}>
                            Lv.{player.previous.level} (零頭經驗：{Number(player.previous.exp_val).toLocaleString()})
                          </p>
                        ) : (
                          <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>(此為起始基準 7/30 紀錄)</p>
                        )}
                      </div>
                      <div>
                        <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#0284c7', fontWeight: 'bold' }}>📍 最新上傳紀錄 ({latestTime})：</p>
                        <p style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#0f172a' }}>
                          Lv.{player.latest.level} (零頭經驗：{Number(player.latest.exp_val).toLocaleString()})
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '5px' }}>🖼️ 上一次截圖憑證：</p>
                        {player.previous && player.previous.photo_url ? (
                          <a href={player.previous.photo_url} target="_blank" rel="noreferrer">
                            <img src={player.previous.photo_url} alt="前次截圖" style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                          </a>
                        ) : (
                          <div style={{ height: '180px', background: '#f1f5f9', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
                            無前次截圖（此為基準點）
                          </div>
                        )}
                      </div>

                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#0284c7', marginBottom: '5px' }}>🖼️ 最新上傳截圖（點擊可放大看原圖）：</p>
                        {player.latest.photo_url ? (
                          <a href={player.latest.photo_url} target="_blank" rel="noreferrer">
                            <img src={player.latest.photo_url} alt="最新截圖" style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #0284c7' }} />
                          </a>
                        ) : (
                          <div style={{ height: '180px', background: '#f1f5f9', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
                            無截圖
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
