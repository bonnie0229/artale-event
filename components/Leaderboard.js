import React from 'react';

function getPrize(rank) {
  if (rank === 1) return "🥇 闇黑龍王披風";
  if (rank === 2) return "🥈 楓葉祝福２０";
  if (rank === 3) return "🥉 闇黑龍王項鍊";
  if (rank === 4) return "🏅 雪花300";
  if (rank === 5) return "🏅 突襲劵14張";
  if (rank >= 6 && rank <= 14) return "🏅 突襲劵7張";
  if (rank === 15) return "🏅 商城寵物一隻";
  if (rank >= 16 && rank <= 20) return "🏅 雪花50";
  return null;
}

export default function Leaderboard({ players = [] }) {
  return (
    <div style={{ padding: '20px', background: '#1e293b', color: '#fff', borderRadius: '12px' }}>
      <h2 style={{ color: '#facc15' }}>🏆 iDotCat 夏日練等大賽 - 即時總排行榜</h2>
      {players.length === 0 ? (
        <p>目前尚無已審核的成績，快來上傳！</p>
      ) : (
        players.map((p, idx) => {
          const rank = idx + 1;
          const prize = getPrize(rank);
          return (
            <div key={p.char_id} style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0', padding: '10px', background: '#334155', borderRadius: '8px' }}>
              <div>
                <strong>#{rank} {p.char_id}</strong> (Lv.{p.level})
                {prize && <div style={{ color: '#fde047', fontSize: '12px' }}>{prize}</div>}
              </div>
              <div style={{ color: '#4ade80', fontWeight: 'bold' }}>
                +{p.gained_exp ? p.gained_exp.toLocaleString() : 0} EXP
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
