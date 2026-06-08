import { useState, useEffect, useCallback } from "react";

const SB_URL = 'https://yykgwrkziiyyackcixet.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5a2d3cmt6aWl5eWFja2NpeGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTU4NDUsImV4cCI6MjA5NjQzMTg0NX0.BAboKgvb2yPZ92sImq6ePT4QicPJR_11XgaX9UAteZg';
const H = {
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function db(path, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H, ...opts });
  if (!r.ok) throw new Error(await r.text());
  if (r.status === 204) return [];
  const t = await r.text();
  return t ? JSON.parse(t) : [];
}

function calcPts(pred, m) {
  if (!m.is_finished || m.home_score === null) return null;
  let p = 0;
  if (Math.sign(m.home_score - m.away_score) === Math.sign(pred.home_score_pred - pred.away_score_pred)) p += 3;
  if (pred.home_score_pred === m.home_score) p += 1;
  if (pred.away_score_pred === m.away_score) p += 1;
  return p;
}

function isClosed(d) { return Date.now() >= new Date(d).getTime() - 10 * 60 * 1000; }

function fmt(d) {
  return new Date(d).toLocaleString('es-CO', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota'
  });
}

const FL = {
  'México':'🇲🇽','Sudáfrica':'🇿🇦','Corea del Sur':'🇰🇷','Rep. Checa':'🇨🇿',
  'Canadá':'🇨🇦','Bosnia y Herz.':'🇧🇦','Qatar':'🇶🇦','Suiza':'🇨🇭',
  'Brasil':'🇧🇷','Marruecos':'🇲🇦','Haití':'🇭🇹','Escocia':'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Estados Unidos':'🇺🇸','Australia':'🇦🇺','Paraguay':'🇵🇾','Turquía':'🇹🇷',
  'Alemania':'🇩🇪','Curazao':'🇨🇼','Costa de Marfil':'🇨🇮','Ecuador':'🇪🇨',
  'Países Bajos':'🇳🇱','Japón':'🇯🇵','Suecia':'🇸🇪','Túnez':'🇹🇳',
  'Bélgica':'🇧🇪','Irán':'🇮🇷','Egipto':'🇪🇬','Nueva Zelanda':'🇳🇿',
  'España':'🇪🇸','Cabo Verde':'🇨🇻','Arabia Saudita':'🇸🇦','Uruguay':'🇺🇾',
  'Francia':'🇫🇷','Senegal':'🇸🇳','Irak':'🇮🇶','Noruega':'🇳🇴',
  'Argentina':'🇦🇷','Argelia':'🇩🇿','Austria':'🇦🇹','Jordania':'🇯🇴',
  'Portugal':'🇵🇹','RD del Congo':'🇨🇩','Uzbekistán':'🇺🇿','Colombia':'🇨🇴',
  'Inglaterra':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Croacia':'🇭🇷','Ghana':'🇬🇭','Panamá':'🇵🇦',
};
const fl = t => FL[t] || '⚽';
const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
const MEDALS = ['🥇','🥈','🥉'];
const BG = '#0B1F3A', BG2 = '#152D52', BLUE = '#1E3A6E', RED = '#CE1126', GOLD = '#FFD700';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login');
  const [tab, setTab] = useState('partidos');
  const [isReg, setIsReg] = useState(false);
  const [matches, setMatches] = useState([]);
  const [parts, setParts] = useState([]);
  const [preds, setPreds] = useState([]);
  const [phases, setPhases] = useState([]);
  const [group, setGroup] = useState('A');
  const [detailPart, setDetailPart] = useState(null);
  const [form, setForm] = useState({ name: '', pass: '', conf: '' });
  const [pf, setPf] = useState({});
  const [rf, setRf] = useState({});
  const [rtf, setRtf] = useState({});
  const [resultEdit, setResultEdit] = useState(null);
  const [timeEdit, setTimeEdit] = useState(null);
  const [toast, setToast] = useState({ msg: '', ok: true });
  const [loading, setLoading] = useState(true);

  const say = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast({ msg: '', ok: true }), 3000);
  };

  const load = useCallback(async () => {
    try {
      const [m, p, pr, ph] = await Promise.all([
        db('matches?select=*&order=match_number.asc'),
        db('participants?select=*&order=name.asc'),
        db('predictions?select=*'),
        db('phases?select=*&order=sort_order.asc'),
      ]);
      setMatches(m); setParts(p); setPreds(pr); setPhases(ph);
    } catch (e) { say('Error cargando datos', false); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const login = async () => {
    if (!form.name || !form.pass) return say('Completa todos los campos', false);
    try {
      const r = await db(`participants?name=eq.${encodeURIComponent(form.name)}&password=eq.${encodeURIComponent(form.pass)}&select=*`);
      if (!r.length) return say('Apodo o contraseña incorrectos', false);
      setUser(r[0]); setView('main'); setForm({ name: '', pass: '', conf: '' });
    } catch (e) { say('Error de conexión', false); }
  };

  const register = async () => {
    if (!form.name || !form.pass || !form.conf) return say('Completa todos los campos', false);
    if (form.pass !== form.conf) return say('Las contraseñas no coinciden', false);
    if (form.name.length < 2) return say('El apodo debe tener al menos 2 caracteres', false);
    try {
      const result = await db('participants', { method: 'POST', body: JSON.stringify({ name: form.name, password: form.pass, is_admin: false }) });
      const nu = Array.isArray(result) ? result[0] : result;
      setUser(nu); await load(); setView('main'); setForm({ name: '', pass: '', conf: '' });
    } catch (e) {
      say(e.message.includes('unique') ? 'Ese apodo ya está en uso' : 'Error al registrarse', false);
    }
  };

  const savePred = async (matchId) => {
    const f = pf[matchId];
    if (!f || f.h === '' || f.a === '') return say('Ingresa ambos marcadores', false);
    const ex = preds.find(p => p.participant_id === user.id && p.match_id === matchId);
    try {
      if (ex) {
        await db(`predictions?id=eq.${ex.id}`, { method: 'PATCH', body: JSON.stringify({ home_score_pred: +f.h, away_score_pred: +f.a }) });
      } else {
        await db('predictions', { method: 'POST', body: JSON.stringify({ participant_id: user.id, match_id: matchId, home_score_pred: +f.h, away_score_pred: +f.a }) });
      }
      say('¡Predicción guardada! ✅'); await load();
    } catch (e) { say('Error guardando predicción', false); }
  };

  const saveResult = async (matchId) => {
    const f = rf[matchId];
    if (!f || f.h === '' || f.a === '') return say('Ingresa el resultado', false);
    try {
      await db(`matches?id=eq.${matchId}`, { method: 'PATCH', body: JSON.stringify({ home_score: +f.h, away_score: +f.a, is_finished: true }) });
      say('¡Resultado guardado! ⚽'); setResultEdit(null); await load();
    } catch (e) { say('Error guardando resultado', false); }
  };

  const saveTime = async (matchId) => {
    const t = rtf[matchId];
    if (!t) return;
    try {
      await db(`matches?id=eq.${matchId}`, { method: 'PATCH', body: JSON.stringify({ match_date: new Date(t).toISOString() }) });
      say('¡Hora actualizada!'); setTimeEdit(null); await load();
    } catch (e) { say('Error actualizando hora', false); }
  };

  const ranking = () => parts.map(p => {
    const myPreds = preds.filter(pr => pr.participant_id === p.id);
    let total = 0, golesEx = 0, marcEx = 0;
    myPreds.forEach(pr => {
      const m = matches.find(m => m.id === pr.match_id);
      if (m && m.is_finished) {
        const pts = calcPts(pr, m);
        if (pts !== null) total += pts;
        if (pr.home_score_pred === m.home_score) golesEx++;
        if (pr.away_score_pred === m.away_score) golesEx++;
        if (pr.home_score_pred === m.home_score && pr.away_score_pred === m.away_score) marcEx++;
      }
    });
    return { ...p, total, golesEx, marcEx };
  }).sort((a, b) => b.total - a.total || b.golesEx - a.golesEx);

  const card = { background: BG2, borderRadius: 12, padding: 16, marginBottom: 12, border: `1px solid ${BLUE}` };
  const btn = (bg = RED, extra = {}) => ({ background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%', fontFamily: 'inherit', ...extra });
  const inp = { background: BG, border: `1px solid ${BLUE}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
  const scoreInp = { ...inp, width: 54, fontSize: 22, fontWeight: 800, textAlign: 'center', padding: '6px 4px' };

  const rnk = ranking();

  if (view === 'login') return (
    <div style={{ fontFamily: "'Barlow', sans-serif", background: BG, minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, maxWidth: 480, margin: '0 auto' }}>
      {toast.msg && <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#1B5E20' : RED, color: '#fff', borderRadius: '0 0 10px 10px', padding: '10px 20px', fontSize: 14, fontWeight: 600, zIndex: 999, whiteSpace: 'nowrap' }}>{toast.msg}</div>}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 60, marginBottom: 8 }}>🏆</div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 34, fontWeight: 800, letterSpacing: 2 }}>POLLA MUNDIAL</div>
        <div style={{ color: RED, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700 }}>USA · MÉXICO · CANADÁ 2026</div>
      </div>
      <div style={card}>
        <div style={{ display: 'flex', marginBottom: 20, background: BG, borderRadius: 8, padding: 4 }}>
          <button style={{ flex: 1, padding: 8, borderRadius: 6, background: !isReg ? RED : 'transparent', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }} onClick={() => setIsReg(false)}>Ingresar</button>
          <button style={{ flex: 1, padding: 8, borderRadius: 6, background: isReg ? RED : 'transparent', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }} onClick={() => setIsReg(true)}>Registrarse</button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: '#A0B4C8', fontSize: 13, marginBottom: 4, display: 'block' }}>Apodo</label>
          <input style={inp} placeholder="Tu apodo en la polla" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div style={{ marginBottom: isReg ? 12 : 20 }}>
          <label style={{ color: '#A0B4C8', fontSize: 13, marginBottom: 4, display: 'block' }}>Contraseña</label>
          <input style={inp} type="password" placeholder="Contraseña" value={form.pass} onChange={e => setForm({ ...form, pass: e.target.value })} onKeyDown={e => e.key === 'Enter' && (isReg ? register() : login())} />
        </div>
        {isReg && <div style={{ marginBottom: 20 }}>
          <label style={{ color: '#A0B4C8', fontSize: 13, marginBottom: 4, display: 'block' }}>Confirmar contraseña</label>
          <input style={inp} type="password" placeholder="Repite la contraseña" value={form.conf} onChange={e => setForm({ ...form, conf: e.target.value })} onKeyDown={e => e.key === 'Enter' && register()} />
        </div>}
        <button style={btn()} onClick={isReg ? register : login}>{isReg ? '✅ Crear cuenta' : '🚀 Entrar'}</button>
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ fontFamily: "'Barlow', sans-serif", background: BG, minHeight: '100vh', color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 48 }}>⚽</div><div style={{ marginTop: 12, color: '#A0B4C8' }}>Cargando...</div></div>
    </div>
  );

  if (detailPart) {
    const pr = preds.filter(p => p.participant_id === detailPart.id);
    const me = rnk.find(r => r.id === detailPart.id) || { total: 0, marcEx: 0, golesEx: 0 };
    const pos = rnk.findIndex(r => r.id === detailPart.id) + 1;
    return (
      <div style={{ fontFamily: "'Barlow', sans-serif", background: BG, minHeight: '100vh', color: '#fff', maxWidth: 480, margin: '0 auto', paddingBottom: 20 }}>
        <div style={{ background: `linear-gradient(135deg,${RED} 0%,${BG} 60%)`, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
          <button onClick={() => setDetailPart(null)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer', borderRadius: 6, padding: '6px 12px', fontFamily: 'inherit' }}>← Volver</button>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800 }}>{detailPart.name}</span>
          <span style={{ fontSize: 22 }}>{pos <= 3 ? MEDALS[pos - 1] : `#${pos}`}</span>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {[{ l: 'Puntos', v: me.total, c: GOLD }, { l: 'Exactos', v: me.marcEx, c: '#4CAF50' }, { l: 'Goles ex.', v: me.golesEx, c: '#4A90D9' }].map(x => (
              <div key={x.l} style={{ ...card, flex: 1, textAlign: 'center', padding: 12, marginBottom: 0 }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, color: x.c }}>{x.v}</div>
                <div style={{ color: '#A0B4C8', fontSize: 11 }}>{x.l}</div>
              </div>
            ))}
          </div>
          {GROUPS.map(g => {
            const gm = matches.filter(m => m.group_name === g);
            const items = gm.map(m => ({ m, pred: pr.find(p => p.match_id === m.id) })).filter(x => x.m.is_finished || x.pred);
            if (!items.length) return null;
            return (
              <div key={g} style={{ marginBottom: 12 }}>
                <div style={{ color: RED, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>GRUPO {g}</div>
                {items.map(({ m, pred }) => {
                  const showPred = isClosed(m.match_date) || detailPart.id === user.id || user.is_admin;
                  const pts = pred && m.is_finished ? calcPts(pred, m) : null;
                  return (
                    <div key={m.id} style={{ ...card, marginBottom: 6, padding: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, flex: 1, textAlign: 'right' }}>{fl(m.home_team)} {m.home_team}</span>
                        <span style={{ padding: '0 8px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: m.is_finished ? GOLD : '#A0B4C8', fontSize: m.is_finished ? 18 : 14 }}>
                          {m.is_finished ? `${m.home_score} - ${m.away_score}` : 'vs'}
                        </span>
                        <span style={{ fontSize: 12, flex: 1 }}>{fl(m.away_team)} {m.away_team}</span>
                      </div>
                      {showPred && pred && (
                        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#A0B4C8', fontSize: 12 }}>Apostó: <b style={{ color: '#fff' }}>{pred.home_score_pred} - {pred.away_score_pred}</b></span>
                          {pts !== null && <span style={{ background: pts === 5 ? GOLD : pts >= 3 ? '#1B5E20' : pts > 0 ? '#1565C0' : '#333', color: pts === 5 ? '#000' : '#fff', borderRadius: 10, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{pts} pts</span>}
                        </div>
                      )}
                      {!showPred && <div style={{ marginTop: 4, color: '#A0B4C8', fontSize: 12, textAlign: 'center' }}>🔒 Se revela al cerrar el partido</div>}
                      {showPred && !pred && <div style={{ marginTop: 4, color: '#555', fontSize: 12, textAlign: 'center' }}>Sin predicción</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const gMatches = matches.filter(m => m.group_name === group);

  return (
    <div style={{ fontFamily: "'Barlow', sans-serif", background: BG, minHeight: '100vh', color: '#fff', maxWidth: 480, margin: '0 auto', paddingBottom: 72 }}>
      {toast.msg && <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#1B5E20' : RED, color: '#fff', borderRadius: '0 0 10px 10px', padding: '10px 20px', fontSize: 14, fontWeight: 600, zIndex: 999, whiteSpace: 'nowrap' }}>{toast.msg}</div>}

      <div style={{ background: `linear-gradient(135deg,${RED} 0%,${BG} 60%)`, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: 1 }}>⚽ POLLA MUNDIAL 2026</div>
          <div style={{ color: GOLD, fontSize: 12 }}>{user.name} {user.is_admin ? '👑' : ''}</div>
        </div>
        <button onClick={() => { setUser(null); setView('login'); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Salir</button>
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {tab === 'partidos' && (
          <div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12 }}>
              {GROUPS.map(g => (
                <button key={g} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, background: group === g ? RED : BLUE, color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }} onClick={() => setGroup(g)}>{g}</button>
              ))}
            </div>
            {gMatches.map(m => {
              const cl = isClosed(m.match_date);
              const myPred = preds.find(p => p.participant_id === user.id && p.match_id === m.id);
              const myPts = myPred && m.is_finished ? calcPts(myPred, m) : null;
              const f = pf[m.id] || { h: myPred?.home_score_pred ?? '', a: myPred?.away_score_pred ?? '' };
              return (
                <div key={m.id} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ color: '#A0B4C8', fontSize: 11 }}>#{m.match_number} · {fmt(m.match_date)}</span>
                    {m.is_finished ? <span style={{ background: '#1B5E20', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 10 }}>Final</span>
                      : cl ? <span style={{ background: '#7D0018', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 10 }}>Cerrado</span>
                        : <span style={{ background: '#1565C0', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 10 }}>Abierto</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <div style={{ fontSize: 26 }}>{fl(m.home_team)}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#E0E0E0', lineHeight: 1.3 }}>{m.home_team}</div>
                    </div>
                    <div style={{ padding: '0 14px', textAlign: 'center', minWidth: 80 }}>
                      {m.is_finished ? <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, color: GOLD }}>{m.home_score} - {m.away_score}</div>
                        : <div style={{ color: '#A0B4C8', fontSize: 18, fontWeight: 700 }}>vs</div>}
                      <div style={{ color: '#A0B4C8', fontSize: 10, marginTop: 2 }}>{m.venue}</div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: 26 }}>{fl(m.away_team)}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#E0E0E0', lineHeight: 1.3 }}>{m.away_team}</div>
                    </div>
                  </div>
                  {!cl && !m.is_finished && (
                    <div style={{ borderTop: `1px solid ${BLUE}`, paddingTop: 10 }}>
                      <div style={{ color: '#A0B4C8', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>Tu predicción</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                        <input type="number" min="0" max="20" style={scoreInp} value={f.h} onChange={e => setPf({ ...pf, [m.id]: { ...f, h: e.target.value } })} placeholder="0" />
                        <span style={{ color: '#A0B4C8', fontSize: 20, fontWeight: 700 }}>-</span>
                        <input type="number" min="0" max="20" style={scoreInp} value={f.a} onChange={e => setPf({ ...pf, [m.id]: { ...f, a: e.target.value } })} placeholder="0" />
                        <button style={btn(RED, { width: 'auto', padding: '8px 14px', fontSize: 13 })} onClick={() => savePred(m.id)}>{myPred ? 'Actualizar' : 'Guardar'}</button>
                      </div>
                    </div>
                  )}
                  {cl && (
                    <div style={{ borderTop: `1px solid ${BLUE}`, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {myPred ? <span style={{ fontSize: 13 }}>🎯 Mi apuesta: <b>{myPred.home_score_pred} - {myPred.away_score_pred}</b></span>
                        : <span style={{ color: '#555', fontSize: 12 }}>No apostaste</span>}
                      {myPts !== null && <span style={{ background: myPts === 5 ? GOLD : myPts >= 3 ? '#1B5E20' : myPts > 0 ? '#1565C0' : '#333', color: myPts === 5 ? '#000' : '#fff', borderRadius: 12, padding: '3px 12px', fontSize: 13, fontWeight: 700 }}>{myPts} pts</span>}
                    </div>
                  )}
                  {user.is_admin && !m.is_finished && cl && (
                    <div style={{ marginTop: 10 }}>
                      {resultEdit === m.id ? (
                        <div>
                          <div style={{ color: '#A0B4C8', fontSize: 12, marginBottom: 6, textAlign: 'center' }}>Resultado final (tiempo reglamentario)</div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                            <input type="number" min="0" style={scoreInp} value={rf[m.id]?.h ?? ''} onChange={e => setRf({ ...rf, [m.id]: { ...rf[m.id], h: e.target.value } })} placeholder="0" />
                            <span style={{ color: '#A0B4C8', fontWeight: 700 }}>-</span>
                            <input type="number" min="0" style={scoreInp} value={rf[m.id]?.a ?? ''} onChange={e => setRf({ ...rf, [m.id]: { ...rf[m.id], a: e.target.value } })} placeholder="0" />
                            <button style={btn('#28A745', { width: 'auto', padding: '8px 12px', fontSize: 14 })} onClick={() => saveResult(m.id)}>✓</button>
                            <button style={btn('#555', { width: 'auto', padding: '8px 12px', fontSize: 14 })} onClick={() => setResultEdit(null)}>✕</button>
                          </div>
                        </div>
                      ) : (
                        <button style={btn('#1565C0', { fontSize: 12, padding: 8 })} onClick={() => setResultEdit(m.id)}>👑 Ingresar resultado</button>
                      )}
                    </div>
                  )}
                  {user.is_admin && !m.is_finished && !cl && (
                    <div style={{ marginTop: 8 }}>
                      {timeEdit === m.id ? (
                        <div>
                          <div style={{ color: '#A0B4C8', fontSize: 12, marginBottom: 4 }}>Nueva fecha/hora (hora Colombia)</div>
                          <input type="datetime-local" style={{ ...inp, marginBottom: 8 }} value={rtf[m.id] || ''} onChange={e => setRtf({ ...rtf, [m.id]: e.target.value })} />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button style={btn('#28A745', { fontSize: 12, padding: '7px 12px' })} onClick={() => saveTime(m.id)}>Guardar hora</button>
                            <button style={btn('#555', { fontSize: 12, padding: '7px 12px' })} onClick={() => setTimeEdit(null)}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <button style={{ background: 'transparent', border: `1px solid ${BLUE}`, borderRadius: 6, color: '#A0B4C8', fontSize: 11, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setTimeEdit(m.id)}>⏰ Ajustar hora del partido</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'ranking' && (
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 16, color: GOLD }}>🏆 RANKING</div>
            {rnk.map((p, i) => (
              <div key={p.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 8 }} onClick={() => setDetailPart(p)}>
                <div style={{ fontSize: 24, minWidth: 36, textAlign: 'center' }}>
                  {i < 3 ? MEDALS[i] : <span style={{ color: '#A0B4C8', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18 }}>#{i + 1}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name} {p.is_admin ? '👑' : ''}</div>
                  <div style={{ color: '#A0B4C8', fontSize: 12 }}>{p.marcEx} exactos · {p.golesEx} goles ex.</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 800, color: GOLD }}>{p.total}</div>
                  <div style={{ color: '#A0B4C8', fontSize: 11 }}>pts</div>
                </div>
              </div>
            ))}
            {!rnk.length && <div style={{ textAlign: 'center', color: '#A0B4C8', marginTop: 40 }}>Aún no hay participantes</div>}
          </div>
        )}

        {tab === 'perfil' && (() => {
          const me = rnk.find(r => r.id === user.id) || { total: 0, marcEx: 0, golesEx: 0 };
          const pos = rnk.findIndex(r => r.id === user.id) + 1;
          return (
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 16 }}>👤 MI PERFIL</div>
              <div style={{ ...card, textAlign: 'center' }}>
                <div style={{ fontSize: 52, marginBottom: 8 }}>🏅</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 800 }}>{user.name}</div>
                {user.is_admin && <div style={{ color: GOLD, fontSize: 14, marginBottom: 4 }}>Administrador 👑</div>}
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  {[{ l: 'POSICIÓN', v: `#${pos || '-'}`, c: RED }, { l: 'PUNTOS', v: me.total, c: GOLD }, { l: 'EXACTOS', v: me.marcEx, c: '#4CAF50' }].map(x => (
                    <div key={x.l} style={{ flex: 1, background: BG, borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 10, color: '#A0B4C8', marginBottom: 2 }}>{x.l}</div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, color: x.c }}>{x.v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <button style={btn(BG2, { border: `1px solid ${RED}`, marginTop: 0 })} onClick={() => setDetailPart(user)}>Ver mis predicciones detalladas →</button>
            </div>
          );
        })()}

        {tab === 'admin' && user.is_admin && (
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 16, color: GOLD }}>👑 ADMINISTRACIÓN</div>
            <div style={{ color: RED, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>FASES DEL TORNEO</div>
            {phases.map(ph => (
              <div key={ph.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{ph.name}</div>
                  <div style={{ fontSize: 12, color: '#A0B4C8' }}>{ph.accumulate_points ? '✅ Acumula puntos' : '🔄 Puntos independientes'}</div>
                </div>
                <div>
                  {ph.is_active && <span style={{ background: '#1B5E20', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11 }}>Activa</span>}
                  {ph.is_finished && <span style={{ background: '#333', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11 }}>Finalizada</span>}
                  {!ph.is_active && !ph.is_finished && <span style={{ background: BLUE, color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11 }}>Pendiente</span>}
                </div>
              </div>
            ))}
            <div style={{ color: RED, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, margin: '16px 0 8px' }}>PARTICIPANTES ({parts.length})</div>
            {parts.map(p => (
              <div key={p.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, cursor: 'pointer' }} onClick={() => setDetailPart(p)}>
                <span style={{ fontWeight: 600 }}>{p.name} {p.is_admin ? '👑' : ''}</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: GOLD, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{rnk.find(r => r.id === p.id)?.total || 0} pts</div>
                  <div style={{ color: '#A0B4C8', fontSize: 11 }}>{preds.filter(pr => pr.participant_id === p.id).length} predicciones</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#0D2240', borderTop: `1px solid ${BLUE}`, display: 'flex', zIndex: 100 }}>
        {[
          { id: 'partidos', icon: '📅', label: 'Partidos' },
          { id: 'ranking', icon: '🏆', label: 'Ranking' },
          { id: 'perfil', icon: '👤', label: 'Mi Perfil' },
          ...(user.is_admin ? [{ id: 'admin', icon: '👑', label: 'Admin' }] : []),
        ].map(t => (
          <button key={t.id} style={{ flex: 1, padding: '10px 4px', textAlign: 'center', fontSize: 11, color: tab === t.id ? RED : '#A0B4C8', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', borderTop: tab === t.id ? `2px solid ${RED}` : '2px solid transparent' }} onClick={() => setTab(t.id)}>
            <div style={{ fontSize: 20 }}>{t.icon}</div>
            <div style={{ marginTop: 2 }}>{t.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
