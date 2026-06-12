import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = {
  bg: '#14100a',
  gold: '#c9a227',
  red: '#8b1a1a',
  cream: '#f0e6d3',
  smoke: '#6b5c4e',
  darkRed: '#6b0e0e',
  purple: '#6b5b8b',
};

const ROLE_COLORS = {
  Mafia: '#ff7777',
  Detective: '#7799ff',
  Doctor: '#77ffaa',
  Vigilante: '#ffcc88',
  Villager: '#c9a227',
  Jester: '#ffaaff',
  Mayor: '#aaeeff',
  Blackmailer: '#ddaaff',
  Executioner: '#eeeebb',
  Joker: '#aaffee',
  Giant: '#ffddaa',
  Drunk: '#ffcc99',
};

const ROLE_ICONS = {
  Mafia: '🔪',
  Detective: '🔍',
  Doctor: '💉',
  Vigilante: '⚔️',
  Villager: '🧑',
  Jester: '🃏',
  Mayor: '🎖️',
  Blackmailer: '🖤',
  Executioner: '⚖️',
  Joker: '🃏',
  Giant: '🗿',
  Drunk: '🍷',
};

const ROLE_DESCRIPTIONS = {
  Mafia: 'Eliminate the villagers. You know your teammates.',
  Detective: 'Each night, investigate one player to learn if they are MAFIA or INNOCENT.',
  Doctor: 'Each night, protect one player (even yourself) from being killed.',
  Vigilante: 'Defender of the village. Cast the deciding vote in a tie.',
  Villager: 'Find and vote out the Mafia before they outnumber you.',
  Jester: "Win if the village VOTES YOU OUT. Dying at night doesn't count.",
  Mayor: 'Your vote counts double. Keep your role secret.',
  Blackmailer: "Each night, silence one player — they cannot chat or vote tomorrow.",
  Executioner: 'Win if your secret target is VOTED OUT by the village.',
  Joker: "Win if MAFIA KILLS YOU at night. Being voted out doesn't count.",
  Giant: 'You need two hits to die. The first hit only wounds you.',
  Drunk: "You think you're the Detective, but your instincts are unreliable.",
};

const OPTIONAL_ROLES = [
  { name: 'Jester', icon: '🃏', min: 5, description: 'Wins if voted out by village' },
  { name: 'Mayor', icon: '🎖️', min: 5, description: 'Vote counts double; identity secret' },
  { name: 'Blackmailer', icon: '🖤', min: 6, description: 'Mafia-aligned; silences one player each night' },
  { name: 'Executioner', icon: '⚖️', min: 5, description: 'Wins if secret target is voted out' },
  { name: 'Joker', icon: '🃏', min: 5, description: 'Wins if killed at night by Mafia' },
  { name: 'Giant', icon: '🗿', min: 5, description: 'Needs two hits to die; first hit = wounded' },
  { name: 'Drunk', icon: '🍷', min: 5, description: "Thinks they're Detective; gets fake investigation results" },
];

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ─── Utilities ────────────────────────────────────────────────────────────────
function genCode() {
  return Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function assignRoles(playerCount, optionalRoles = []) {
  const roles = [];
  const mafiaCount = Math.max(1, Math.floor(playerCount / 4));
  for (let i = 0; i < mafiaCount; i++) roles.push('Mafia');
  roles.push('Vigilante');
  if (playerCount >= 6) {
    roles.push('Detective');
    roles.push('Doctor');
  }
  const optEnabled = optionalRoles.filter(r => playerCount >= (OPTIONAL_ROLES.find(o => o.name === r)?.min || 99));
  for (const opt of optEnabled) {
    roles.push(opt);
  }
  while (roles.length < playerCount) roles.push('Villager');
  return shuffle(roles);
}

function buildRoom(code, hostId, hostName) {
  return {
    code,
    hostId,
    phase: 'lobby',
    round: 0,
    players: [{ id: hostId, name: hostName, role: null, dead: false, wounded: false, isAI: false, executionerTarget: null, blackmailed: false }],
    nightActions: {},
    votes: {},
    tally: {},
    lastVotes: {},
    lastTally: {},
    lastElim: null,
    tieBreakCandidates: [],
    blackmailed: [],
    narration: '',
    log: [],
    readyForNight: [],
    winner: null,
    winnerName: null,
    optionalRoles: [],
    maxPlayers: 12,
    aiCount: 0,
  };
}

// ─── Claude API ───────────────────────────────────────────────────────────────
async function claudeRequest(system, user, maxTokens = 200) {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!key) return 'The night holds its secrets close...';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || 'Silence falls over the village...';
  } catch {
    return 'The shadows speak in whispers too quiet to hear...';
  }
}

const NARRATOR_SYSTEM = "You are the dramatic narrator of a Mafia party game set in 1930s Sicily. Write vivid atmospheric noir prose. 2-4 sentences. Never break character. Never use player names as role names.";

async function narrate(prompt) {
  return claudeRequest(NARRATOR_SYSTEM, prompt, 150);
}

async function aiChat(playerName, role, context, isMafia) {
  const system = `You are ${playerName}, a villager in a 1930s Sicilian Mafia game. Speak in 1-2 sentences of noir atmosphere. Never directly state your role. ${isMafia ? 'You are secretly Mafia — deflect suspicion and blame innocents subtly.' : role === 'Detective' ? 'You are Detective — hint subtly at your findings without revealing yourself.' : role === 'Doctor' ? 'Stay quiet and observe carefully.' : 'Accuse and speculate like a true villager.'}`;
  return claudeRequest(system, context, 100);
}

// ─── Firebase helpers ─────────────────────────────────────────────────────────
async function saveRoom(room) {
  await window.storage.set(`room_${room.code}`, JSON.stringify(room));
}

async function loadRoom(code) {
  const { value } = await window.storage.get(`room_${code}`);
  return JSON.parse(value);
}

async function saveGhostChat(code, messages) {
  await window.storage.set(`ghost_${code}`, JSON.stringify(messages));
}

async function loadGhostChat(code) {
  try {
    const { value } = await window.storage.get(`ghost_${code}`);
    return JSON.parse(value);
  } catch {
    return [];
  }
}

// ─── Global Styles ────────────────────────────────────────────────────────────
const GLOBAL_STYLE = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #14100a; color: #f0e6d3; font-family: 'Crimson Text', serif; min-height: 100vh; }
  #root { min-height: 100vh; position: relative; }
  #root::before {
    content: '';
    position: fixed; inset: 0; pointer-events: none; z-index: 9999;
    background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px);
  }
  h1, h2, h3 { font-family: 'Playfair Display', serif; font-style: italic; }
  button { cursor: pointer; font-family: 'Crimson Text', serif; }
  input { font-family: 'Crimson Text', serif; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #14100a; }
  ::-webkit-scrollbar-thumb { background: #6b5c4e; border-radius: 2px; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
  @keyframes glow { 0%,100% { text-shadow: 0 0 8px currentColor; } 50% { text-shadow: 0 0 20px currentColor; } }
`;

// ─── Sub-components ────────────────────────────────────────────────────────────
function Btn({ children, onClick, disabled, variant = 'gold', style = {}, small }) {
  const base = {
    padding: small ? '6px 16px' : '10px 24px',
    fontSize: small ? '14px' : '16px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '4px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'all 0.15s',
    letterSpacing: '0.05em',
  };
  const variants = {
    gold: { background: COLORS.gold, color: '#14100a' },
    red: { background: COLORS.red, color: COLORS.cream },
    ghost: { background: 'transparent', color: COLORS.gold, border: `1px solid ${COLORS.gold}` },
    dark: { background: 'rgba(255,255,255,0.07)', color: COLORS.cream, border: '1px solid rgba(255,255,255,0.1)' },
  };
  return (
    <button style={{ ...base, ...variants[variant], ...style }} onClick={disabled ? undefined : onClick}>
      {children}
    </button>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid rgba(201,162,39,0.25)`,
      borderRadius: '8px',
      padding: '16px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, style = {}, maxLength }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: `1px solid ${COLORS.smoke}`,
        borderRadius: '4px',
        padding: '10px 14px',
        color: COLORS.cream,
        fontSize: '16px',
        width: '100%',
        outline: 'none',
        ...style,
      }}
    />
  );
}

function Typewriter({ text, speed = 22, onDone }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(iv);
        setDone(true);
        onDone?.();
      }
    }, speed);
    return () => clearInterval(iv);
  }, [text]);
  return (
    <p style={{ fontStyle: 'italic', fontSize: '17px', lineHeight: 1.7, color: COLORS.cream }}>
      {displayed}
      {!done && <span style={{ opacity: 0.6 }}>|</span>}
    </p>
  );
}

function PlayerCard({ player, onClick, selected, showRole, isYou, myRole }) {
  const isMafiaViewer = myRole === 'Mafia' || myRole === 'Blackmailer';
  const isMafiaTeammate = isMafiaViewer && (player.role === 'Mafia' || player.role === 'Blackmailer') && !isYou;
  const borderColor = selected
    ? COLORS.darkRed
    : isYou
    ? COLORS.gold
    : isMafiaTeammate
    ? COLORS.red
    : 'rgba(201,162,39,0.2)';
  const bg = selected
    ? 'rgba(139,26,26,0.35)'
    : player.dead
    ? 'rgba(0,0,0,0.3)'
    : 'rgba(255,255,255,0.04)';

  return (
    <div
      onClick={player.dead || !onClick ? undefined : onClick}
      style={{
        padding: '10px 12px',
        borderRadius: '6px',
        border: `2px solid ${borderColor}`,
        borderStyle: player.dead ? 'dashed' : 'solid',
        background: bg,
        cursor: player.dead || !onClick ? 'default' : 'pointer',
        opacity: player.dead ? 0.55 : 1,
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        color: player.dead ? COLORS.smoke : COLORS.cream,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: showRole && player.role ? `${ROLE_COLORS[player.role]}22` : 'rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '18px', flexShrink: 0,
        border: `1px solid ${showRole && player.role ? ROLE_COLORS[player.role] + '55' : 'transparent'}`,
      }}>
        {player.dead ? '✝' : player.isAI ? '🤖' : showRole && player.role ? ROLE_ICONS[player.role] : '👤'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {isMafiaTeammate && <span style={{ color: COLORS.red }}>🔴</span>}
          {player.name}
          {isYou && <span style={{ color: COLORS.gold, fontSize: '12px' }}>(You)</span>}
          {player.dead && <span style={{ color: COLORS.smoke, fontSize: '12px' }}>Eliminated</span>}
          {player.wounded && !player.dead && <span style={{ fontSize: '12px', color: ROLE_COLORS.Giant }}>⚔️ Wounded</span>}
          {player.blackmailed && !player.dead && <span style={{ fontSize: '12px', color: COLORS.smoke }}>🔇</span>}
        </div>
        {showRole && player.role && (
          <div style={{ fontSize: '13px', color: ROLE_COLORS[player.role] }}>
            {ROLE_ICONS[player.role]} {player.role}
          </div>
        )}
      </div>
    </div>
  );
}

function VoteBreakdown({ tally, votes, players, lastElim }) {
  if (!tally || Object.keys(tally).length === 0) return null;
  const total = Object.values(tally).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: '13px', color: COLORS.smoke, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Vote Tally</div>
      {entries.map(([id, count]) => {
        const p = players.find(x => x.id === id);
        if (!p || count === 0) return null;
        const pct = Math.max(8, Math.round((count / total) * 100));
        const eliminated = id === lastElim;
        const voters = Object.entries(votes || {})
          .filter(([, v]) => v === id)
          .map(([vid]) => players.find(x => x.id === vid)?.name || '?');
        return (
          <div key={id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: 4 }}>
              <span style={{ color: eliminated ? COLORS.red : COLORS.cream }}>{p.name} {eliminated && '💀'}</span>
              <span style={{ color: COLORS.smoke }}>{count} vote{count !== 1 ? 's' : ''} ({Math.round((count / total) * 100)}%)</span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: eliminated ? COLORS.red : COLORS.gold, borderRadius: 4, transition: 'width 0.5s' }} />
            </div>
            {voters.length > 0 && (
              <div style={{ fontSize: '12px', color: COLORS.smoke, marginTop: 2 }}>Voted by: {voters.join(', ')}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Game Logic ───────────────────────────────────────────────────────────────
function getAlive(players) { return players.filter(p => !p.dead); }
function getMafia(players) { return players.filter(p => (p.role === 'Mafia' || p.role === 'Blackmailer') && !p.dead); }

function checkWin(players) {
  const alive = getAlive(players);
  const mafiaAlive = getMafia(players);
  const nonMafia = alive.filter(p => p.role !== 'Mafia' && p.role !== 'Blackmailer');
  if (mafiaAlive.length === 0) return { winner: 'Town', winnerName: 'Town' };
  if (mafiaAlive.length >= nonMafia.length) return { winner: 'Mafia', winnerName: 'Mafia' };
  if (mafiaAlive.length === 1 && alive.find(p => p.role === 'Doctor') && alive.length === 2) {
    return { winner: 'Tie', winnerName: 'Tie' };
  }
  return null;
}

function resolveNight(room) {
  const { players, nightActions } = room;
  const ps = players.map(p => ({ ...p }));
  const { mafia, doctor, blackmail } = nightActions;

  let killedId = mafia;
  const savedId = doctor;
  let jokerWin = null;
  const newBlackmailed = blackmail ? [blackmail] : [];

  if (killedId && savedId === killedId) {
    killedId = null;
  }

  let eliminated = null;
  if (killedId) {
    const target = ps.find(p => p.id === killedId);
    if (target) {
      if (target.role === 'Joker') {
        jokerWin = target.id;
      } else if (target.role === 'Giant') {
        if (!target.wounded) {
          target.wounded = true;
          killedId = null;
        } else {
          target.dead = true;
          eliminated = target;
        }
      } else {
        target.dead = true;
        eliminated = target;
      }
    }
  }

  return { players: ps, eliminated, savedId, killedId, jokerWin, newBlackmailed };
}

// ─── Screen Wrapper ────────────────────────────────────────────────────────────
function Screen({ title, subtitle, children, style = {} }) {
  return (
    <div style={{
      minHeight: '100vh', padding: '20px 16px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      animation: 'fadeIn 0.3s ease',
      ...style,
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {title && (
          <h1 style={{ color: COLORS.gold, fontSize: 30, textAlign: 'center', marginBottom: 4, animation: 'glow 3s ease infinite' }}>
            {title}
          </h1>
        )}
        {subtitle && (
          <p style={{ color: COLORS.smoke, textAlign: 'center', marginBottom: 24, fontSize: '15px' }}>
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

// ─── Lock Screen ───────────────────────────────────────────────────────────────
function LockScreen({ message, onUnlock }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#14100a',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, zIndex: 100,
    }}>
      <div style={{ fontSize: 48, marginBottom: 24 }}>🔒</div>
      <h2 style={{ color: COLORS.gold, marginBottom: 16, textAlign: 'center', fontFamily: 'Playfair Display', fontStyle: 'italic' }}>{message}</h2>
      <p style={{ color: COLORS.smoke, textAlign: 'center', marginBottom: 32, maxWidth: 300, lineHeight: 1.6 }}>
        Pass the phone to the next player. They will tap below when ready.
      </p>
      <Btn onClick={onUnlock}>I am ready →</Btn>
    </div>
  );
}

// ─── PP Role Reveal ────────────────────────────────────────────────────────────
function PPRoleReveal({ player, role, teammates, executionerTarget, players, onAck }) {
  const [shown, setShown] = useState(false);
  if (!shown) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#14100a',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24, zIndex: 100,
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: COLORS.gold, textAlign: 'center', marginBottom: 8, fontFamily: 'Playfair Display', fontStyle: 'italic' }}>{player}</h2>
        <p style={{ color: COLORS.smoke, textAlign: 'center', marginBottom: 32 }}>Tap below to see your role — keep it secret!</p>
        <Btn onClick={() => setShown(true)}>Reveal My Role →</Btn>
      </div>
    );
  }
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#14100a',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, zIndex: 100, overflowY: 'auto',
    }}>
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>{ROLE_ICONS[role]}</div>
        <h1 style={{ color: ROLE_COLORS[role], fontSize: 32, marginBottom: 4, fontFamily: 'Playfair Display', fontStyle: 'italic' }}>{player}</h1>
        <h2 style={{ color: COLORS.cream, marginBottom: 16, fontFamily: 'Playfair Display', fontStyle: 'italic' }}>You are the {role}</h2>
        <Card style={{ width: '100%', marginBottom: 16, textAlign: 'center' }}>
          <p style={{ color: COLORS.smoke, fontSize: '15px', lineHeight: 1.6 }}>{ROLE_DESCRIPTIONS[role]}</p>
        </Card>
        {(role === 'Mafia' || role === 'Blackmailer') && teammates.length > 0 && (
          <Card style={{ width: '100%', marginBottom: 16, background: 'rgba(139,26,26,0.2)', borderColor: COLORS.red }}>
            <p style={{ color: COLORS.red, fontSize: '13px', marginBottom: 4 }}>Your Mafia team:</p>
            {teammates.map(t => <p key={t} style={{ color: COLORS.cream }}>{t}</p>)}
          </Card>
        )}
        {role === 'Executioner' && executionerTarget && (
          <Card style={{ width: '100%', marginBottom: 16, background: 'rgba(238,238,187,0.1)', borderColor: ROLE_COLORS.Executioner }}>
            <p style={{ color: ROLE_COLORS.Executioner, fontSize: '13px', marginBottom: 4 }}>Your target:</p>
            <p style={{ color: COLORS.cream }}>{players.find(p => p.id === executionerTarget)?.name || '?'}</p>
          </Card>
        )}
        <Btn onClick={onAck} style={{ width: '100%' }}>I understand my role →</Btn>
      </div>
    </div>
  );
}

// ─── Ghost View ────────────────────────────────────────────────────────────────
function GhostView({ ghostChat, ghostInput, setGhostInput, onSend }) {
  return (
    <Card style={{ marginTop: 16, borderColor: '#6b5b8b', background: 'rgba(107,91,139,0.1)' }}>
      <p style={{ color: '#9b8bbb', fontSize: '13px', marginBottom: 10 }}>👻 Ghost Chat — only the dead can see this</p>
      <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ghostChat.map(msg => (
          <div key={msg.id} style={{ fontSize: '14px', color: '#b0a0cc' }}>
            <span style={{ color: '#9b8bbb', fontWeight: 600 }}>{msg.name}: </span>{msg.text}
          </div>
        ))}
        {ghostChat.length === 0 && <p style={{ color: '#6b5b8b', fontSize: '13px', fontStyle: 'italic' }}>Silence...</p>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Input value={ghostInput} onChange={setGhostInput} placeholder="Whisper from beyond..." style={{ flex: 1, borderColor: '#6b5b8b' }} />
        <Btn onClick={onSend} variant="dark" small>↑</Btn>
      </div>
    </Card>
  );
}

// ─── Vote Breakdown ────────────────────────────────────────────────────────────

// ─── Online Lobby ─────────────────────────────────────────────────────────────
function OnlineLobby({ room, myId, isHost, onRoomUpdate, onStart }) {
  const [copied, setCopied] = useState(false);

  async function addAI() {
    if (room.players.length >= 12) return;
    const ai = { id: `ai_${genId()}`, name: `Don ${room.aiCount + 1}`, role: null, dead: false, wounded: false, isAI: true, executionerTarget: null, blackmailed: false };
    await onRoomUpdate({ ...room, players: [...room.players, ai], aiCount: room.aiCount + 1 });
  }

  async function removeAI() {
    const ais = room.players.filter(p => p.isAI);
    if (!ais.length) return;
    const toRemove = ais[ais.length - 1];
    await onRoomUpdate({ ...room, players: room.players.filter(p => p.id !== toRemove.id), aiCount: Math.max(0, room.aiCount - 1) });
  }

  async function toggleOptional(name) {
    const cur = room.optionalRoles || [];
    const next = cur.includes(name) ? cur.filter(r => r !== name) : [...cur, name];
    await onRoomUpdate({ ...room, optionalRoles: next });
  }

  function copyCode() {
    navigator.clipboard.writeText(room.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const canStart = room.players.length >= 4;

  return (
    <Screen title="The Gathering" subtitle="Waiting for players">
      <Card style={{ textAlign: 'center', marginBottom: 16 }}>
        <p style={{ color: COLORS.smoke, fontSize: '13px', marginBottom: 4 }}>Room Code</p>
        <div onClick={copyCode} style={{ fontSize: 36, fontFamily: 'Playfair Display', color: COLORS.gold, letterSpacing: '0.2em', cursor: 'pointer', fontStyle: 'italic' }}>
          {room.code}
        </div>
        <p style={{ color: COLORS.smoke, fontSize: '12px', marginTop: 4 }}>{copied ? '✓ Copied!' : 'Tap to copy'}</p>
      </Card>

      <div style={{ marginBottom: 16 }}>
        <p style={{ color: COLORS.smoke, fontSize: '13px', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Players ({room.players.length}/12)
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {room.players.map(p => (
            <PlayerCard key={p.id} player={p} isYou={p.id === myId} myRole={null} />
          ))}
        </div>
      </div>

      {isHost && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <p style={{ color: COLORS.smoke, fontSize: '13px', marginBottom: 10 }}>
              AI Players ({room.players.filter(p => p.isAI).length})
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={removeAI} variant="dark" small>Remove AI</Btn>
              <Btn onClick={addAI} variant="ghost" small disabled={room.players.length >= 12}>Add AI</Btn>
            </div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <p style={{ color: COLORS.smoke, fontSize: '13px', marginBottom: 12 }}>Optional Roles</p>
            {OPTIONAL_ROLES.map(opt => {
              const locked = room.players.length < opt.min;
              const on = (room.optionalRoles || []).includes(opt.name);
              return (
                <div key={opt.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12, opacity: locked ? 0.4 : 1 }}>
                  <input type="checkbox" checked={on} onChange={() => !locked && toggleOptional(opt.name)} disabled={locked} style={{ marginTop: 3, accentColor: COLORS.gold }} />
                  <div>
                    <div style={{ color: COLORS.cream, fontSize: '14px' }}>{opt.icon} {opt.name}</div>
                    <div style={{ color: COLORS.smoke, fontSize: '12px' }}>{opt.description}</div>
                    {locked && <div style={{ color: COLORS.smoke, fontSize: '11px' }}>Requires {opt.min}+ players</div>}
                  </div>
                </div>
              );
            })}
          </Card>

          <Btn onClick={() => onStart(room)} disabled={!canStart} style={{ width: '100%', marginBottom: 8 }}>
            Start Game ({room.players.length} players)
          </Btn>
          {!canStart && <p style={{ color: COLORS.smoke, textAlign: 'center', fontSize: '13px' }}>Need at least 4 players to start</p>}
        </>
      )}
      {!isHost && (
        <Card style={{ textAlign: 'center' }}>
          <p style={{ color: COLORS.smoke, animation: 'pulse 2s infinite' }}>Waiting for host to start the game...</p>
        </Card>
      )}
    </Screen>
  );
}

// ─── Online Game ───────────────────────────────────────────────────────────────
function OnlineGame({ room, myId, onRoomUpdate }) {
  const me = room.players.find(p => p.id === myId);
  const isHost = room.hostId === myId;
  const resolving = useRef(false);
  const chatInitiatedRound = useRef(-1);
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [ghostChat, setGhostChat] = useState([]);
  const [ghostInput, setGhostInput] = useState('');
  const ghostPollRef = useRef(null);
  const [detectiveResult, setDetectiveResult] = useState(null);
  const [drunkResult, setDrunkResult] = useState(null);
  const [showingResult, setShowingResult] = useState(false);
  const [narrationDone, setNarrationDone] = useState(false);

  useEffect(() => {
    setNarrationDone(false);
  }, [room.phase, room.round]);

  useEffect(() => {
    if (me?.dead) {
      ghostPollRef.current = setInterval(async () => {
        const msgs = await loadGhostChat(room.code);
        setGhostChat(msgs);
      }, 2000);
    }
    return () => clearInterval(ghostPollRef.current);
  }, [me?.dead, room.code]);

  useEffect(() => {
    if (room.phase === 'day' && room.round !== chatInitiatedRound.current) {
      const hasAI = room.players.some(p => p.isAI && !p.dead);
      if (hasAI) {
        chatInitiatedRound.current = room.round;
        fireAIChat();
      }
    }
  }, [room.phase, room.round]);

  async function fireAIChat() {
    const aiPlayers = room.players.filter(p => p.isAI && !p.dead);
    const context = `Round ${room.round}. Last night: ${room.narration || 'nothing notable occurred.'}`;
    for (const ai of aiPlayers) {
      const isMafia = ai.role === 'Mafia' || ai.role === 'Blackmailer';
      const text = await aiChat(ai.name, ai.role, context, isMafia);
      setChat(prev => [...prev, { id: genId(), name: ai.name, text, isAI: true }]);
    }
  }

  async function sendHumanChat() {
    if (!chatInput.trim() || me?.blackmailed) return;
    const msg = { id: genId(), name: me.name, text: chatInput.trim(), isAI: false };
    setChat(prev => [...prev, msg]);
    setChatInput('');
    const aiPlayers = room.players.filter(p => p.isAI && !p.dead);
    let guaranteed = false;
    for (const ai of aiPlayers) {
      if (Math.random() < 0.75 || !guaranteed) {
        guaranteed = true;
        const text = await aiChat(ai.name, ai.role, `${me.name} says: "${msg.text}"`, ai.role === 'Mafia' || ai.role === 'Blackmailer');
        setChat(prev => [...prev, { id: genId(), name: ai.name, text, isAI: true }]);
      }
    }
  }

  async function sendGhostChat() {
    if (!ghostInput.trim() || !me?.dead) return;
    const msgs = await loadGhostChat(room.code);
    const updated = [...msgs, { id: genId(), name: me.name, text: ghostInput.trim() }];
    await saveGhostChat(room.code, updated);
    setGhostChat(updated);
    setGhostInput('');
  }

  async function submitNightAction(targetId) {
    if (!me || me.dead) return;
    const roleToAction = { Mafia: 'mafia', Detective: 'detective', Doctor: 'doctor', Blackmailer: 'blackmail', Drunk: 'drunk' };
    const action = roleToAction[me.role];
    if (!action) return;

    if (action === 'detective') {
      const target = room.players.find(p => p.id === targetId);
      const result = (target?.role === 'Mafia' || target?.role === 'Blackmailer') ? 'MAFIA' : 'INNOCENT';
      setDetectiveResult({ name: target?.name, result });
      setShowingResult(true);
    } else if (action === 'drunk') {
      const target = room.players.find(p => p.id === targetId);
      const result = Math.random() < 0.5 ? 'MAFIA' : 'INNOCENT';
      setDrunkResult({ name: target?.name, result });
      setShowingResult(true);
    }

    const newRoom = { ...room, nightActions: { ...room.nightActions, [action]: targetId } };
    await onRoomUpdate(newRoom);
    if (isHost) await tryResolveNight(newRoom);
  }

  async function tryResolveNight(r) {
    if (resolving.current) return;
    const alive = getAlive(r.players);
    const mafiaHuman = alive.find(p => (p.role === 'Mafia' || p.role === 'Blackmailer') && !p.isAI);
    if (mafiaHuman && !r.nightActions.mafia) return;
    const detHuman = alive.find(p => p.role === 'Detective' && !p.isAI);
    if (detHuman && !r.nightActions.detective) return;
    const docHuman = alive.find(p => p.role === 'Doctor' && !p.isAI);
    if (docHuman && !r.nightActions.doctor) return;
    const bmHuman = alive.find(p => p.role === 'Blackmailer' && !p.isAI);
    if (bmHuman && !r.nightActions.blackmail) return;
    const drunkHuman = alive.find(p => p.role === 'Drunk' && !p.isAI);
    if (drunkHuman && !r.nightActions.drunk) return;
    resolving.current = true;
    await doResolveNight(r);
    resolving.current = false;
  }

  async function fillAINightActions(r) {
    const alive = getAlive(r.players);
    const mafiaTeamIds = alive.filter(p => p.role === 'Mafia' || p.role === 'Blackmailer').map(p => p.id);
    const actions = { ...r.nightActions };

    if (!actions.mafia) {
      const mafiaAI = alive.find(p => (p.role === 'Mafia' || p.role === 'Blackmailer') && p.isAI);
      if (mafiaAI) {
        const targets = alive.filter(p => !mafiaTeamIds.includes(p.id));
        if (targets.length) actions.mafia = targets[Math.floor(Math.random() * targets.length)].id;
      }
    }
    if (!actions.detective) {
      const det = alive.find(p => p.role === 'Detective' && p.isAI);
      if (det) {
        const targets = alive.filter(p => p.id !== det.id);
        if (targets.length) actions.detective = targets[Math.floor(Math.random() * targets.length)].id;
      }
    }
    if (!actions.doctor) {
      const doc = alive.find(p => p.role === 'Doctor' && p.isAI);
      if (doc) {
        if (alive.length) actions.doctor = alive[Math.floor(Math.random() * alive.length)].id;
      }
    }
    if (!actions.blackmail) {
      const bm = alive.find(p => p.role === 'Blackmailer' && p.isAI);
      if (bm) {
        const targets = alive.filter(p => !mafiaTeamIds.includes(p.id));
        if (targets.length) actions.blackmail = targets[Math.floor(Math.random() * targets.length)].id;
      }
    }
    if (!actions.drunk) {
      const drunk = alive.find(p => p.role === 'Drunk' && p.isAI);
      if (drunk) {
        const targets = alive.filter(p => p.id !== drunk.id);
        if (targets.length) actions.drunk = targets[Math.floor(Math.random() * targets.length)].id;
      }
    }
    return { ...r, nightActions: actions };
  }

  async function doResolveNight(r) {
    r = await fillAINightActions(r);
    const { players, eliminated, jokerWin, newBlackmailed } = resolveNight(r);

    if (jokerWin) {
      const joker = players.find(p => p.id === jokerWin);
      const narr = await narrate(`The darkness took another soul in the night — but this was no ordinary victim. ${joker?.name} had sought exactly this fate, and in dying, they have won.`);
      await onRoomUpdate({ ...r, players, winner: 'Joker', winnerName: joker?.name, narration: narr, phase: 'game_over' });
      return;
    }

    let narr;
    if (eliminated) {
      narr = await narrate(`As dawn breaks over the cobblestones of Sicily, the village discovers ${eliminated.name} has been found dead. The shadows claimed another soul in the night.`);
    } else {
      narr = await narrate(`The village awakens to find no body this morning. Someone was shielded from the darkness, or the killers stayed their hand.`);
    }

    const newPlayers = players.map(p => ({ ...p, blackmailed: newBlackmailed.includes(p.id) }));
    const winCheck = checkWin(newPlayers);
    if (winCheck) {
      await onRoomUpdate({ ...r, players: newPlayers, winner: winCheck.winner, winnerName: winCheck.winnerName, narration: narr, lastElim: eliminated?.id, phase: 'game_over' });
      return;
    }
    await onRoomUpdate({ ...r, players: newPlayers, phase: 'day', narration: narr, lastElim: eliminated?.id, nightActions: {}, votes: {}, tally: {}, lastVotes: r.votes, lastTally: r.tally });
  }

  async function submitVote(targetId) {
    if (me?.blackmailed || me?.dead) return;
    const newRoom = { ...room, votes: { ...room.votes, [myId]: targetId } };
    await onRoomUpdate(newRoom);
    if (isHost) await tryResolveVote(newRoom);
  }

  async function tryResolveVote(r) {
    if (resolving.current) return;
    const alive = getAlive(r.players).filter(p => !p.blackmailed);
    const allVoted = alive.every(p => r.votes[p.id]);
    if (!allVoted) {
      // Fill AI votes
      let updated = { ...r, votes: { ...r.votes } };
      for (const ai of alive.filter(p => p.isAI && !r.votes[p.id])) {
        const targets = getAlive(r.players).filter(p => p.id !== ai.id);
        if (!targets.length) continue;
        if (ai.role === 'Jester' && Math.random() < 0.4) {
          updated.votes[ai.id] = ai.id;
        } else {
          updated.votes[ai.id] = targets[Math.floor(Math.random() * targets.length)].id;
        }
      }
      const allVotedNow = getAlive(updated.players).filter(p => !p.blackmailed).every(p => updated.votes[p.id]);
      if (!allVotedNow) {
        await onRoomUpdate(updated);
        return;
      }
      r = updated;
    }
    resolving.current = true;
    await doResolveVote(r);
    resolving.current = false;
  }

  async function doResolveVote(r) {
    const tally = {};
    for (const [voterId, targetId] of Object.entries(r.votes)) {
      if (targetId === 'skip') continue;
      const voter = r.players.find(p => p.id === voterId);
      const weight = voter?.role === 'Mayor' ? 2 : 1;
      tally[targetId] = (tally[targetId] || 0) + weight;
    }
    if (!Object.keys(tally).length) return;

    const max = Math.max(...Object.values(tally));
    const tied = Object.entries(tally).filter(([, v]) => v === max).map(([id]) => id);

    if (tied.length > 1) {
      const vigAlive = getAlive(r.players).find(p => p.role === 'Vigilante');
      if (vigAlive) {
        await onRoomUpdate({ ...r, tally, phase: 'tie_break', tieBreakCandidates: tied });
        return;
      }
      const elim = tied[Math.floor(Math.random() * tied.length)];
      await applyElimination(r, elim, tally);
    } else {
      await applyElimination(r, tied[0], tally);
    }
  }

  async function applyElimination(r, elimId, tally) {
    const target = r.players.find(p => p.id === elimId);
    if (!target) return;

    if (target.role === 'Giant' && !target.wounded) {
      const players = r.players.map(p => p.id === elimId ? { ...p, wounded: true } : p);
      const narr = await narrate(`The village casts their votes — and ${target.name} absorbs the blow like stone. They are wounded, but unbroken.`);
      await onRoomUpdate({ ...r, players, phase: 'night', round: r.round + 1, narration: narr, tally, lastVotes: r.votes, lastTally: tally, lastElim: null, votes: {}, nightActions: {} });
      return;
    }

    let players = r.players.map(p => p.id === elimId ? { ...p, dead: true } : p);
    let winner = null, winnerName = null;

    if (target.role === 'Jester') {
      winner = 'Jester'; winnerName = target.name;
    } else {
      const exc = players.find(p => p.role === 'Executioner' && !p.dead);
      if (exc && exc.executionerTarget === elimId) {
        winner = 'Executioner'; winnerName = exc.name;
      }
    }

    if (target.role === 'Vigilante') {
      const villagers = players.filter(p => p.role === 'Villager' && !p.dead);
      if (villagers.length) {
        const promoted = villagers[Math.floor(Math.random() * villagers.length)];
        players = players.map(p => p.id === promoted.id ? { ...p, role: 'Vigilante' } : p);
      }
    }

    const narr = await narrate(`The village has made its decision. ${target.name} is dragged from the square${target.role === 'Jester' ? ', laughing wildly as they go' : ''}. Their role is exposed: ${target.role}.`);

    if (!winner) {
      const winCheck = checkWin(players);
      if (winCheck) { winner = winCheck.winner; winnerName = winCheck.winnerName; }
    }

    if (winner) {
      await onRoomUpdate({ ...r, players, winner, winnerName, narration: narr, tally, lastVotes: r.votes, lastTally: tally, lastElim: elimId, phase: 'game_over', votes: {} });
      return;
    }
    await onRoomUpdate({ ...r, players: players.map(p => ({ ...p, blackmailed: false })), phase: 'night', round: r.round + 1, narration: narr, tally, lastVotes: r.votes, lastTally: tally, lastElim: elimId, votes: {}, nightActions: {} });
  }

  async function submitTieBreak(targetId) {
    await applyElimination({ ...room, votes: room.lastVotes || {} }, targetId, room.tally || {});
  }

  if (!me) return null;

  // ── Role Reveal ────────────────────────────────────────────────────────────
  if (room.phase === 'role_reveal') {
    const ready = room.readyForNight || [];
    const meReady = ready.includes(myId);
    return (
      <Screen title="Your Role">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>{ROLE_ICONS[me.role]}</div>
          <h2 style={{ color: ROLE_COLORS[me.role], fontSize: 28, marginBottom: 8 }}>{me.role}</h2>
          <p style={{ color: COLORS.smoke, fontSize: '15px', lineHeight: 1.6 }}>{ROLE_DESCRIPTIONS[me.role]}</p>
        </div>
        {(me.role === 'Mafia' || me.role === 'Blackmailer') && (
          <Card style={{ marginBottom: 16, background: 'rgba(139,26,26,0.2)', borderColor: COLORS.red }}>
            <p style={{ color: COLORS.red, fontSize: '13px', marginBottom: 6 }}>Your Mafia team:</p>
            {room.players.filter(p => (p.role === 'Mafia' || p.role === 'Blackmailer') && p.id !== myId).map(p => (
              <p key={p.id} style={{ color: COLORS.cream }}>{p.name}</p>
            ))}
          </Card>
        )}
        {me.role === 'Executioner' && me.executionerTarget && (
          <Card style={{ marginBottom: 16, background: 'rgba(238,238,187,0.1)', borderColor: ROLE_COLORS.Executioner }}>
            <p style={{ color: ROLE_COLORS.Executioner, fontSize: '13px', marginBottom: 4 }}>Your secret target:</p>
            <p style={{ color: COLORS.cream }}>{room.players.find(p => p.id === me.executionerTarget)?.name}</p>
          </Card>
        )}
        {meReady ? (
          <Card style={{ textAlign: 'center' }}>
            <p style={{ color: COLORS.smoke, animation: 'pulse 2s infinite' }}>
              Waiting for others... ({ready.length}/{room.players.length})
            </p>
          </Card>
        ) : (
          <Btn style={{ width: '100%' }} onClick={async () => {
            const newReady = [...(room.readyForNight || []), myId];
            const allReady = newReady.length >= room.players.length;
            // AI auto-acknowledge: add all AI ids
            const aiIds = room.players.filter(p => p.isAI).map(p => p.id);
            const fullReady = [...new Set([...newReady, ...aiIds])];
            const allReadyNow = fullReady.length >= room.players.length;
            await onRoomUpdate({ ...room, readyForNight: fullReady, phase: allReadyNow ? 'night' : 'role_reveal' });
          }}>
            I understand my role →
          </Btn>
        )}
      </Screen>
    );
  }

  // ── Detective / Drunk result modal ─────────────────────────────────────────
  if (showingResult && (detectiveResult || drunkResult)) {
    const res = detectiveResult || drunkResult;
    const isDrunk = !!drunkResult;
    return (
      <Screen title={isDrunk ? '🍷 Your Instincts' : '🔍 Your Finding'}>
        <Card style={{ textAlign: 'center', marginBottom: 24, padding: 24 }}>
          {isDrunk
            ? <p style={{ color: COLORS.smoke, marginBottom: 8 }}>🍷 Your fuzzy instincts say…</p>
            : <p style={{ color: COLORS.smoke, marginBottom: 8 }}>You investigated:</p>
          }
          <h2 style={{ color: COLORS.cream, marginBottom: 16 }}>{res.name}</h2>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{res.result === 'MAFIA' ? '🔴' : '🟢'}</div>
          <h2 style={{ color: res.result === 'MAFIA' ? COLORS.red : '#77ffaa', fontSize: 28 }}>{res.result}</h2>
          {isDrunk && <p style={{ color: COLORS.smoke, fontSize: '13px', marginTop: 12, fontStyle: 'italic' }}>…but can you trust yourself?</p>}
        </Card>
        <Btn style={{ width: '100%' }} onClick={() => {
          setShowingResult(false);
          setDetectiveResult(null);
          setDrunkResult(null);
        }}>
          Memorise this — Continue →
        </Btn>
      </Screen>
    );
  }

  // ── Night ──────────────────────────────────────────────────────────────────
  if (room.phase === 'night') {
    const alive = getAlive(room.players);
    const mafiaTeamIds = alive.filter(p => p.role === 'Mafia' || p.role === 'Blackmailer').map(p => p.id);
    const roleToAction = { Mafia: 'mafia', Detective: 'detective', Doctor: 'doctor', Blackmailer: 'blackmail', Drunk: 'drunk' };
    const action = roleToAction[me.role];
    const alreadyDone = action ? !!room.nightActions[action] : true;

    let targets = [];
    let actionLabel = '';
    if (me.role === 'Mafia') { targets = alive.filter(p => !mafiaTeamIds.includes(p.id)); actionLabel = '🔪 Choose your target'; }
    else if (me.role === 'Blackmailer') { targets = alive.filter(p => !mafiaTeamIds.includes(p.id)); actionLabel = '🖤 Choose someone to silence'; }
    else if (me.role === 'Detective') { targets = alive.filter(p => p.id !== myId); actionLabel = '🔍 Investigate a player'; }
    else if (me.role === 'Drunk') { targets = alive.filter(p => p.id !== myId); actionLabel = '🍷 Investigate a player (your instincts may lie)'; }
    else if (me.role === 'Doctor') { targets = alive; actionLabel = '💉 Protect someone tonight'; }

    return (
      <Screen title={`Night ${room.round}`} subtitle="Sicily sleeps...">
        {me.dead ? (
          <>
            <Card style={{ textAlign: 'center', marginBottom: 16 }}>
              <p style={{ color: COLORS.smoke, animation: 'pulse 2s infinite' }}>You watch from the shadows...</p>
            </Card>
            <GhostView ghostChat={ghostChat} ghostInput={ghostInput} setGhostInput={setGhostInput} onSend={sendGhostChat} />
          </>
        ) : alreadyDone || !action ? (
          <Card style={{ textAlign: 'center' }}>
            <p style={{ color: COLORS.smoke, animation: 'pulse 2s infinite' }}>
              {alreadyDone && action ? 'Your action is submitted. Waiting for others...' : 'The night passes quietly for you...'}
            </p>
          </Card>
        ) : (
          <>
            <p style={{ color: COLORS.smoke, marginBottom: 16, textAlign: 'center', fontSize: '15px' }}>{actionLabel}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {targets.map(p => (
                <PlayerCard key={p.id} player={p} onClick={() => submitNightAction(p.id)} isYou={p.id === myId} myRole={me.role} />
              ))}
            </div>
          </>
        )}
      </Screen>
    );
  }

  // ── Day ────────────────────────────────────────────────────────────────────
  if (room.phase === 'day') {
    const hasAI = room.players.some(p => p.isAI && !p.dead);
    return (
      <Screen title={`Day ${room.round}`} subtitle="The village wakes">
        {room.narration && (
          <Card style={{ marginBottom: 16, borderColor: 'rgba(201,162,39,0.4)' }}>
            <Typewriter text={room.narration} onDone={() => setNarrationDone(true)} />
          </Card>
        )}
        {room.lastTally && Object.keys(room.lastTally).length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <VoteBreakdown tally={room.lastTally} votes={room.lastVotes} players={room.players} lastElim={room.lastElim} />
          </Card>
        )}
        {me.dead ? (
          <>
            <Card style={{ textAlign: 'center', marginBottom: 16 }}>
              <p style={{ color: COLORS.smoke }}>You are eliminated — observing from beyond...</p>
            </Card>
            <GhostView ghostChat={ghostChat} ghostInput={ghostInput} setGhostInput={setGhostInput} onSend={sendGhostChat} />
          </>
        ) : (
          <>
            {me.blackmailed && (
              <Card style={{ marginBottom: 16, borderColor: COLORS.smoke, textAlign: 'center' }}>
                <p style={{ color: COLORS.smoke }}>🔇 You have been silenced — you cannot chat today</p>
              </Card>
            )}
            {hasAI && (
              <Card style={{ marginBottom: 16 }}>
                <p style={{ color: COLORS.smoke, fontSize: '13px', marginBottom: 10 }}>Village Discussion</p>
                <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {chat.map(msg => (
                    <div key={msg.id} style={{
                      padding: '8px 10px', background: msg.isAI ? 'rgba(255,255,255,0.04)' : 'rgba(201,162,39,0.08)',
                      borderRadius: 4, borderLeft: `2px solid ${msg.isAI ? COLORS.smoke : COLORS.gold}`,
                    }}>
                      <span style={{ color: msg.isAI ? COLORS.smoke : COLORS.gold, fontSize: '12px', fontWeight: 600 }}>{msg.name}: </span>
                      <span style={{ color: COLORS.cream, fontSize: '14px' }}>{msg.text}</span>
                    </div>
                  ))}
                  {chat.length === 0 && <p style={{ color: COLORS.smoke, fontSize: '13px', fontStyle: 'italic' }}>The village awaits someone to speak first...</p>}
                </div>
                {!me.blackmailed && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Input value={chatInput} onChange={setChatInput} placeholder="Speak your mind..." style={{ flex: 1 }} />
                    <Btn onClick={sendHumanChat} small>Send</Btn>
                  </div>
                )}
              </Card>
            )}
            <Btn style={{ width: '100%' }} onClick={async () => {
              const newRoom = { ...room, phase: 'vote' };
              await onRoomUpdate(newRoom);
              await tryResolveVote(newRoom);
            }}>
              Call to Vote →
            </Btn>
          </>
        )}
      </Screen>
    );
  }

  // ── Vote ───────────────────────────────────────────────────────────────────
  if (room.phase === 'vote') {
    const alive = getAlive(room.players);
    const myVote = room.votes?.[myId];
    return (
      <Screen title="The Vote" subtitle="Choose who to eliminate">
        {me.dead ? (
          <Card style={{ textAlign: 'center' }}><p style={{ color: COLORS.smoke }}>You watch the vote from the shadows...</p></Card>
        ) : me.blackmailed ? (
          <Card style={{ textAlign: 'center' }}><p style={{ color: COLORS.smoke }}>🔇 You are silenced — you cannot vote today</p></Card>
        ) : myVote ? (
          <Card style={{ textAlign: 'center' }}>
            <p style={{ color: COLORS.smoke }}>Vote cast. Waiting for others...</p>
            <p style={{ color: COLORS.cream, marginTop: 8 }}>You voted: {room.players.find(p => p.id === myVote)?.name}</p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alive.filter(p => p.id !== myId).map(p => (
              <PlayerCard key={p.id} player={p} onClick={() => submitVote(p.id)} myRole={me.role} />
            ))}
          </div>
        )}
        <Card style={{ marginTop: 16 }}>
          <p style={{ color: COLORS.smoke, fontSize: '13px' }}>
            Votes cast: {Object.keys(room.votes || {}).length}/{alive.filter(p => !p.blackmailed).length}
          </p>
        </Card>
      </Screen>
    );
  }

  // ── Tie Break ──────────────────────────────────────────────────────────────
  if (room.phase === 'tie_break') {
    const vig = room.players.find(p => p.role === 'Vigilante' && !p.dead);
    const isVig = vig?.id === myId;
    const candidates = (room.tieBreakCandidates || []).map(id => room.players.find(p => p.id === id)).filter(Boolean);

    useEffect(() => {
      if (vig?.isAI && isHost && candidates.length) {
        const t = setTimeout(async () => {
          const choice = candidates[Math.floor(Math.random() * candidates.length)];
          if (choice) await submitTieBreak(choice.id);
        }, 2000);
        return () => clearTimeout(t);
      }
    }, [room.phase]);

    return (
      <Screen title="The Deadlock" subtitle="Someone must cast the deciding vote">
        <Card style={{ marginBottom: 16, textAlign: 'center' }}>
          <p style={{ color: COLORS.smoke, fontStyle: 'italic', lineHeight: 1.7 }}>
            The village is deadlocked — someone must cast the deciding vote
          </p>
        </Card>
        <Card style={{ marginBottom: 16 }}>
          <VoteBreakdown tally={room.tally} votes={room.votes} players={room.players} lastElim={null} />
        </Card>
        {isVig ? (
          <>
            <Card style={{ marginBottom: 16, borderColor: ROLE_COLORS.Vigilante, background: 'rgba(255,204,136,0.08)' }}>
              <p style={{ color: ROLE_COLORS.Vigilante, textAlign: 'center' }}>⚔️ You are the Vigilante — cast the deciding vote in secret</p>
            </Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {candidates.map(p => (
                <PlayerCard key={p.id} player={p} onClick={() => submitTieBreak(p.id)} myRole={me.role} />
              ))}
            </div>
          </>
        ) : (
          <Card style={{ textAlign: 'center' }}>
            <p style={{ color: COLORS.smoke, animation: 'pulse 2s infinite' }}>Someone holds the deciding vote… waiting for their choice</p>
          </Card>
        )}
      </Screen>
    );
  }

  return null;
}

// ─── Game Over Screen ─────────────────────────────────────────────────────────
function GameOverScreen({ room, myId, onPlayAgain }) {
  const [narr, setNarr] = useState('');
  const WINNER_COLORS = {
    Town: COLORS.gold, Mafia: COLORS.red, Tie: COLORS.purple,
    Jester: '#ffaaff', Joker: '#aaffee', Executioner: ROLE_COLORS.Executioner,
  };
  const wColor = WINNER_COLORS[room.winner] || COLORS.gold;

  useEffect(() => {
    const prompt = room.winner === 'Town'
      ? 'The honest villagers have triumphed over the darkness. Sicily breathes again.'
      : room.winner === 'Mafia'
      ? 'The Mafia has claimed the village. Their shadowy grip tightens over the cobblestones of Sicily.'
      : room.winner === 'Tie'
      ? 'Neither side could break the deadlock. Sicily remains in uneasy, eternal silence.'
      : `${room.winnerName} has achieved their hidden victory in the shadows of Sicily.`;
    narrate(prompt).then(setNarr);
  }, []);

  const title = room.winner === 'Town' ? '⚖️ Town Wins'
    : room.winner === 'Mafia' ? '🔪 Mafia Wins'
    : room.winner === 'Tie' ? '🤝 Stalemate'
    : `${ROLE_ICONS[room.winner] || '🏆'} ${room.winnerName || room.winner} Wins`;

  return (
    <Screen title={title}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 style={{ color: wColor, fontSize: 22, textShadow: `0 0 20px ${wColor}88`, animation: 'glow 2s infinite' }}>
          {room.winner === 'Town' ? 'Justice prevails in Sicily' : room.winner === 'Mafia' ? 'The shadows have won' : 'An unexpected ending'}
        </h2>
      </div>
      {narr && (
        <Card style={{ marginBottom: 16, borderColor: `${wColor}44` }}>
          <Typewriter text={narr} />
        </Card>
      )}
      {room.lastTally && Object.keys(room.lastTally || {}).length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <VoteBreakdown tally={room.lastTally} votes={room.lastVotes} players={room.players} lastElim={room.lastElim} />
        </Card>
      )}
      <Card style={{ marginBottom: 16 }}>
        <p style={{ color: COLORS.smoke, fontSize: '13px', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>All Roles Revealed</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {room.players.map(p => (
            <PlayerCard key={p.id} player={p} showRole isYou={p.id === myId} />
          ))}
        </div>
      </Card>
      <Btn onClick={onPlayAgain} style={{ width: '100%' }}>Play Again →</Btn>
    </Screen>
  );
}

// ─── Pass & Play Setup ─────────────────────────────────────────────────────────
function PassSetup({ onStart }) {
  const [names, setNames] = useState(['', '']);
  const valid = names.filter(n => n.trim()).length >= 4;

  return (
    <Screen title="Pass &amp; Play" subtitle="Enter all player names">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {names.map((n, i) => (
          <div key={i} style={{ display: 'flex', gap: 8 }}>
            <Input value={n} onChange={v => { const a = [...names]; a[i] = v; setNames(a); }} placeholder={`Player ${i + 1}`} maxLength={20} />
            {names.length > 2 && (
              <Btn onClick={() => setNames(names.filter((_, idx) => idx !== i))} variant="dark" small>✕</Btn>
            )}
          </div>
        ))}
      </div>
      <Btn onClick={() => setNames([...names, ''])} variant="ghost" disabled={names.length >= 12} style={{ width: '100%', marginBottom: 16 }}>
        + Add Player
      </Btn>
      <Btn onClick={() => onStart(names.filter(n => n.trim()))} disabled={!valid} style={{ width: '100%' }}>
        Start Game →
      </Btn>
    </Screen>
  );
}

// ─── Pass & Play Game ─────────────────────────────────────────────────────────
function PPGameScreen({ game, setGame }) {
  const [showLock, setShowLock] = useState(false);
  const [lockMessage, setLockMessage] = useState('');
  const [detectiveResult, setDetectiveResult] = useState(null);
  const [showDetResult, setShowDetResult] = useState(false);
  const gameRef = useRef(game);
  useEffect(() => { gameRef.current = game; }, [game]);

  function lock(msg) { setLockMessage(msg); setShowLock(true); }

  // ── Role Reveal Queue ────────────────────────────────────────────────────
  if (game.phase === 'reveal_queue') {
    const p = game.players[game.revealIndex];
    const teammates = game.players.filter(x => (x.role === 'Mafia' || x.role === 'Blackmailer') && x.id !== p.id).map(m => m.name);
    return (
      <PPRoleReveal
        player={p.name} role={p.role} teammates={teammates}
        executionerTarget={p.executionerTarget} players={game.players}
        onAck={() => {
          if (game.revealIndex + 1 >= game.players.length) {
            setGame({ ...gameRef.current, phase: 'night', round: 1 });
          } else {
            setGame({ ...gameRef.current, revealIndex: game.revealIndex + 1 });
          }
        }}
      />
    );
  }

  // ── Winner ───────────────────────────────────────────────────────────────
  if (game.winner) {
    const WINNER_COLORS = { Town: COLORS.gold, Mafia: COLORS.red, Tie: COLORS.purple, Jester: '#ffaaff', Joker: '#aaffee', Executioner: ROLE_COLORS.Executioner };
    const wColor = WINNER_COLORS[game.winner] || COLORS.gold;
    return (
      <Screen title={game.winner === 'Town' ? '⚖️ Town Wins' : game.winner === 'Mafia' ? '🔪 Mafia Wins' : `${game.winnerName || game.winner} Wins`}>
        {game.narration && <Card style={{ marginBottom: 16, borderColor: `${wColor}44` }}><Typewriter text={game.narration} /></Card>}
        {game.lastTally && Object.keys(game.lastTally || {}).length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <VoteBreakdown tally={game.lastTally} votes={game.lastVotes} players={game.players} lastElim={game.lastElim} />
          </Card>
        )}
        <Card style={{ marginBottom: 16 }}>
          <p style={{ color: COLORS.smoke, fontSize: '13px', marginBottom: 12, textTransform: 'uppercase' }}>All Roles</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {game.players.map(p => <PlayerCard key={p.id} player={p} showRole />)}
          </div>
        </Card>
        <Btn style={{ width: '100%' }} onClick={() => window.location.reload()}>Play Again →</Btn>
      </Screen>
    );
  }

  // ── Night ─────────────────────────────────────────────────────────────────
  if (game.phase === 'night') {
    const alive = getAlive(game.players);
    const done = game.nightActions || {};
    const order = ['Mafia', 'Blackmailer', 'Detective', 'Drunk', 'Doctor'];
    let currentRole = null;
    for (const r of order) {
      if (r === 'Mafia' && alive.some(p => p.role === 'Mafia' || p.role === 'Blackmailer') && !done.mafia) { currentRole = 'Mafia'; break; }
      if (r === 'Blackmailer' && alive.some(p => p.role === 'Blackmailer') && !done.blackmail) { currentRole = 'Blackmailer'; break; }
      if (r === 'Detective' && alive.some(p => p.role === 'Detective') && !done.detective) { currentRole = 'Detective'; break; }
      if (r === 'Drunk' && alive.some(p => p.role === 'Drunk') && !done.drunk) { currentRole = 'Drunk'; break; }
      if (r === 'Doctor' && alive.some(p => p.role === 'Doctor') && !done.doctor) { currentRole = 'Doctor'; break; }
    }

    if (!currentRole) {
      // Resolve night
      const { players, eliminated, jokerWin, newBlackmailed } = resolveNight(game);
      const prompt = jokerWin
        ? `The Joker was killed — they have won!`
        : eliminated
        ? `Dawn reveals ${eliminated.name} dead in the streets of Sicily. Their role: ${eliminated.role}.`
        : `The village awakens to find no body. Someone was protected, or the night passed in silence.`;

      narrate(prompt).then(narr => {
        if (jokerWin) {
          const joker = players.find(p => p.id === jokerWin);
          setGame({ ...gameRef.current, players, winner: 'Joker', winnerName: joker?.name, narration: narr });
          return;
        }
        const newPlayers = players.map(p => ({ ...p, blackmailed: newBlackmailed.includes(p.id) }));
        const winCheck = checkWin(newPlayers);
        if (winCheck) {
          setGame({ ...gameRef.current, players: newPlayers, winner: winCheck.winner, winnerName: winCheck.winnerName, narration: narr, lastElim: eliminated?.id });
        } else {
          setGame({ ...gameRef.current, players: newPlayers, phase: 'day', narration: narr, lastElim: eliminated?.id, nightActions: {} });
        }
      });
      return <Screen title="Resolving..."><p style={{ color: COLORS.smoke, textAlign: 'center', animation: 'pulse 2s infinite' }}>The night concludes...</p></Screen>;
    }

    if (showDetResult && detectiveResult) {
      return (
        <Screen title={detectiveResult.isDrunk ? '🍷 Your Instincts' : '🔍 Your Finding'}>
          <Card style={{ textAlign: 'center', marginBottom: 24, padding: 24 }}>
            {detectiveResult.isDrunk
              ? <p style={{ color: COLORS.smoke, marginBottom: 8 }}>🍷 Your fuzzy instincts say…</p>
              : <p style={{ color: COLORS.smoke, marginBottom: 8 }}>You investigated:</p>
            }
            <h2 style={{ color: COLORS.cream, marginBottom: 16 }}>{detectiveResult.name}</h2>
            <div style={{ fontSize: 48, marginBottom: 8 }}>{detectiveResult.result === 'MAFIA' ? '🔴' : '🟢'}</div>
            <h2 style={{ color: detectiveResult.result === 'MAFIA' ? COLORS.red : '#77ffaa', fontSize: 28 }}>{detectiveResult.result}</h2>
            {detectiveResult.isDrunk && <p style={{ color: COLORS.smoke, fontSize: '13px', marginTop: 12, fontStyle: 'italic' }}>…but can you trust yourself?</p>}
          </Card>
          <Btn style={{ width: '100%' }} onClick={() => {
            setShowDetResult(false);
            setDetectiveResult(null);
            lock('Pass the phone face-down for the next role');
          }}>Memorise this — Continue →</Btn>
        </Screen>
      );
    }

    if (showLock) return <LockScreen message={lockMessage} onUnlock={() => setShowLock(false)} />;

    const mafiaTeamIds = alive.filter(p => p.role === 'Mafia' || p.role === 'Blackmailer').map(p => p.id);
    const rolePlayers = alive.filter(p => {
      if (currentRole === 'Mafia') return p.role === 'Mafia' || p.role === 'Blackmailer';
      return p.role === currentRole;
    });
    let targets = [];
    let actionLabel = '';
    const actionKey = currentRole === 'Mafia' ? 'mafia' : currentRole === 'Blackmailer' ? 'blackmail' : currentRole === 'Detective' ? 'detective' : currentRole === 'Drunk' ? 'drunk' : 'doctor';

    if (currentRole === 'Mafia') { targets = alive.filter(p => !mafiaTeamIds.includes(p.id)); actionLabel = '🔪 Mafia: Choose your target'; }
    else if (currentRole === 'Blackmailer') { targets = alive.filter(p => !mafiaTeamIds.includes(p.id)); actionLabel = '🖤 Blackmailer: Choose someone to silence'; }
    else if (currentRole === 'Detective') { targets = alive.filter(p => !rolePlayers.map(x => x.id).includes(p.id)); actionLabel = '🔍 Detective: Investigate a player'; }
    else if (currentRole === 'Drunk') { targets = alive.filter(p => !rolePlayers.map(x => x.id).includes(p.id)); actionLabel = '🍷 Drunk: Investigate a player'; }
    else if (currentRole === 'Doctor') { targets = alive; actionLabel = '💉 Doctor: Protect someone tonight'; }

    return (
      <Screen title={`Night ${game.round}`} subtitle="Pass the phone to the right player">
        <Card style={{ marginBottom: 16, textAlign: 'center', borderColor: `${ROLE_COLORS[currentRole] || COLORS.gold}55` }}>
          <p style={{ color: ROLE_COLORS[currentRole] || COLORS.gold, fontSize: '16px' }}>{actionLabel}</p>
          <p style={{ color: COLORS.smoke, fontSize: '13px', marginTop: 4 }}>
            {rolePlayers.map(p => p.name).join(', ')}
          </p>
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {targets.map(p => (
            <PlayerCard key={p.id} player={p} onClick={() => {
              const newActions = { ...gameRef.current.nightActions, [actionKey]: p.id };
              setGame({ ...gameRef.current, nightActions: newActions });
              if (currentRole === 'Detective') {
                const result = (p.role === 'Mafia' || p.role === 'Blackmailer') ? 'MAFIA' : 'INNOCENT';
                setDetectiveResult({ name: p.name, result, isDrunk: false });
                setShowDetResult(true);
              } else if (currentRole === 'Drunk') {
                const result = Math.random() < 0.5 ? 'MAFIA' : 'INNOCENT';
                setDetectiveResult({ name: p.name, result, isDrunk: true });
                setShowDetResult(true);
              } else {
                lock('Pass the phone face-down for the next role');
              }
            }} />
          ))}
        </div>
      </Screen>
    );
  }

  // ── Day ───────────────────────────────────────────────────────────────────
  if (game.phase === 'day') {
    return (
      <Screen title={`Day ${game.round}`} subtitle="Discuss who to eliminate">
        {game.narration && (
          <Card style={{ marginBottom: 16, borderColor: 'rgba(201,162,39,0.4)' }}>
            <Typewriter text={game.narration} />
          </Card>
        )}
        {game.lastTally && Object.keys(game.lastTally || {}).length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <VoteBreakdown tally={game.lastTally} votes={game.lastVotes} players={game.players} lastElim={game.lastElim} />
          </Card>
        )}
        <Card style={{ marginBottom: 16 }}>
          <p style={{ color: COLORS.smoke, fontSize: '13px', marginBottom: 10, textTransform: 'uppercase' }}>Alive Players</p>
          {getAlive(game.players).map(p => (
            <div key={p.id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', color: COLORS.cream, fontSize: '15px', display: 'flex', gap: 8 }}>
              {p.name}
              {p.blackmailed && <span style={{ color: COLORS.smoke, fontSize: '12px' }}>🔇 Silenced</span>}
              {p.wounded && <span style={{ color: ROLE_COLORS.Giant, fontSize: '12px' }}>⚔️ Wounded</span>}
            </div>
          ))}
        </Card>
        <Btn style={{ width: '100%' }} onClick={() => setGame({ ...game, phase: 'vote', votes: {}, tally: {} })}>
          Call to Vote →
        </Btn>
      </Screen>
    );
  }

  // ── Vote ──────────────────────────────────────────────────────────────────
  if (game.phase === 'vote') {
    const alive = getAlive(game.players);
    const toVote = alive.filter(p => !p.blackmailed);
    const voted = Object.keys(game.votes || {});
    const nextVoter = toVote.find(p => !voted.includes(p.id));

    if (!nextVoter) {
      // Tally and resolve
      const tally = {};
      for (const [vid, tid] of Object.entries(game.votes || {})) {
        if (tid === 'skip') continue;
        const voter = game.players.find(p => p.id === vid);
        const weight = voter?.role === 'Mayor' ? 2 : 1;
        tally[tid] = (tally[tid] || 0) + weight;
      }

      if (!Object.keys(tally).length) {
        setGame({ ...game, phase: 'night', round: game.round + 1, votes: {}, nightActions: {} });
        return null;
      }

      const max = Math.max(...Object.values(tally));
      const tied = Object.entries(tally).filter(([, v]) => v === max).map(([id]) => id);
      const elimId = tied[Math.floor(Math.random() * tied.length)];
      const target = game.players.find(p => p.id === elimId);

      if (target?.role === 'Giant' && !target.wounded) {
        narrate(`The vote falls on ${target.name} — but the Giant absorbs the blow. Wounded, but not defeated.`).then(narr => {
          const players = game.players.map(p => p.id === elimId ? { ...p, wounded: true } : p);
          setGame({ ...game, players, phase: 'night', round: game.round + 1, narration: narr, lastVotes: game.votes, lastTally: tally, lastElim: null, nightActions: {}, votes: {} });
        });
        return <Screen title="Tallying..."><p style={{ color: COLORS.smoke, textAlign: 'center', animation: 'pulse 2s infinite' }}>Counting votes...</p></Screen>;
      }

      let players = game.players.map(p => p.id === elimId ? { ...p, dead: true } : p);
      let winner = null, winnerName = null;

      if (target?.role === 'Jester') {
        winner = 'Jester'; winnerName = target.name;
      } else {
        const exc = players.find(p => p.role === 'Executioner' && !p.dead);
        if (exc && exc.executionerTarget === elimId) { winner = 'Executioner'; winnerName = exc.name; }
      }

      if (target?.role === 'Vigilante') {
        const villagers = players.filter(p => p.role === 'Villager' && !p.dead);
        if (villagers.length) {
          const promoted = villagers[Math.floor(Math.random() * villagers.length)];
          players = players.map(p => p.id === promoted.id ? { ...p, role: 'Vigilante' } : p);
        }
      }

      const winCheck = winner ? null : checkWin(players);
      if (winCheck) { winner = winCheck.winner; winnerName = winCheck.winnerName; }

      narrate(`${target?.name} is eliminated. Their role: ${target?.role}.`).then(narr => {
        if (winner) {
          setGame({ ...game, players, winner, winnerName, narration: narr, lastVotes: game.votes, lastTally: tally, lastElim: elimId });
        } else {
          setGame({ ...game, players: players.map(p => ({ ...p, blackmailed: false })), phase: 'night', round: game.round + 1, narration: narr, lastVotes: game.votes, lastTally: tally, lastElim: elimId, votes: {}, nightActions: {} });
        }
      });
      return <Screen title="Tallying..."><p style={{ color: COLORS.smoke, textAlign: 'center', animation: 'pulse 2s infinite' }}>The verdict is in...</p></Screen>;
    }

    if (showLock) return <LockScreen message={`Pass the phone to ${nextVoter.name}`} onUnlock={() => setShowLock(false)} />;

    return (
      <Screen title="The Vote" subtitle={`${nextVoter.name} — cast your vote`}>
        <p style={{ color: COLORS.smoke, textAlign: 'center', marginBottom: 16, fontSize: '15px' }}>
          {voted.length}/{toVote.length} votes cast
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {alive.filter(p => p.id !== nextVoter.id).map(p => (
            <PlayerCard key={p.id} player={p} onClick={() => {
              const newVotes = { ...gameRef.current.votes, [nextVoter.id]: p.id };
              setGame({ ...gameRef.current, votes: newVotes });
              const remaining = toVote.filter(x => !Object.keys(newVotes).includes(x.id));
              lock(remaining.length ? `Pass the phone to ${remaining[0].name}` : 'Pass the phone to everyone — tallying votes...');
            }} />
          ))}
        </div>
        <Btn variant="ghost" small style={{ width: '100%' }} onClick={() => {
          const newVotes = { ...gameRef.current.votes, [nextVoter.id]: 'skip' };
          setGame({ ...gameRef.current, votes: newVotes });
          const remaining = toVote.filter(x => !Object.keys(newVotes).includes(x.id));
          if (remaining.length) lock(`Pass the phone to ${remaining[0].name}`);
        }}>
          Skip / Abstain
        </Btn>
      </Screen>
    );
  }

  return null;
}

// ─── Root App ─────────────────────────────────────────────────────────────────
function AppRoot() {
  const [screen, setScreen] = useState('home');
  const [myId] = useState(genId);
  const [myName, setMyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ppGame, setPPGame] = useState(null);
  const ppGameRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => { ppGameRef.current = ppGame; }, [ppGame]);
  useEffect(() => () => clearInterval(pollRef.current), []);

  function startPolling(code) {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await loadRoom(code);
        setRoom(r);
      } catch { /* ignore */ }
    }, 2500);
  }

  async function handleCreate() {
    if (!myName.trim()) return;
    setLoading(true); setError('');
    try {
      const code = genCode();
      const r = buildRoom(code, myId, myName.trim());
      await saveRoom(r);
      setRoom(r);
      setScreen('lobby');
      startPolling(code);
    } catch {
      setError('Could not connect to Firebase. Check your environment variables.');
    }
    setLoading(false);
  }

  async function handleJoin() {
    if (!myName.trim() || joinCode.length !== 5) return;
    setLoading(true); setError('');
    try {
      const r = await loadRoom(joinCode);
      if (r.players.length >= r.maxPlayers) { setError('Room is full.'); setLoading(false); return; }
      if (r.phase !== 'lobby') { setError('Game already started.'); setLoading(false); return; }
      const me = { id: myId, name: myName.trim(), role: null, dead: false, wounded: false, isAI: false, executionerTarget: null, blackmailed: false };
      const updated = { ...r, players: [...r.players, me] };
      await saveRoom(updated);
      setRoom(updated);
      setScreen('lobby');
      startPolling(joinCode);
    } catch {
      setError('Room not found. Check the code and try again.');
    }
    setLoading(false);
  }

  async function startOnlineGame(r) {
    const roles = assignRoles(r.players.length, r.optionalRoles);
    const players = r.players.map((p, i) => ({ ...p, role: roles[i], dead: false, wounded: false, blackmailed: false }));
    const exc = players.find(p => p.role === 'Executioner');
    if (exc) {
      const others = players.filter(p => p.id !== exc.id && p.role !== 'Mafia' && p.role !== 'Blackmailer');
      if (others.length) exc.executionerTarget = others[Math.floor(Math.random() * others.length)].id;
    }
    const newRoom = { ...r, players, phase: 'role_reveal', round: 1, readyForNight: [], nightActions: {}, votes: {}, tally: {}, narration: '' };
    await saveRoom(newRoom);
    setRoom(newRoom);
    setScreen('online_game');
  }

  function startPP(names) {
    const players = names.map((name, i) => ({ id: `pp_${i}`, name, role: null, dead: false, wounded: false, isAI: false, executionerTarget: null, blackmailed: false }));
    const roles = assignRoles(players.length, []);
    players.forEach((p, i) => { p.role = roles[i]; });
    const exc = players.find(p => p.role === 'Executioner');
    if (exc) {
      const others = players.filter(p => p.id !== exc.id);
      if (others.length) exc.executionerTarget = others[Math.floor(Math.random() * others.length)].id;
    }
    const game = { players, phase: 'reveal_queue', revealIndex: 0, round: 0, nightActions: {}, votes: {}, tally: {}, lastVotes: {}, lastTally: {}, lastElim: null, blackmailed: [], narration: '', winner: null, winnerName: null };
    setPPGame(game);
    ppGameRef.current = game;
    setScreen('pass_game');
  }

  if (screen === 'home') {
    return (
      <>
        <style>{GLOBAL_STYLE}</style>
        <Screen title="La Famiglia" subtitle="A game of treachery in 1930s Sicily">
          <div style={{ textAlign: 'center', fontSize: 64, marginBottom: 24 }}>🔪</div>
          <Input value={myName} onChange={setMyName} placeholder="Your name" maxLength={20} style={{ marginBottom: 16 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            <Btn onClick={handleCreate} disabled={!myName.trim() || loading} style={{ width: '100%' }}>Create Room</Btn>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input value={joinCode} onChange={v => setJoinCode(v.toUpperCase())} placeholder="Room code" maxLength={5} style={{ flex: 1 }} />
              <Btn onClick={handleJoin} disabled={joinCode.length !== 5 || !myName.trim() || loading} variant="ghost">Join</Btn>
            </div>
            <Btn onClick={() => myName.trim() && setScreen('pass_setup')} disabled={!myName.trim()} variant="dark" style={{ width: '100%' }}>
              Pass &amp; Play
            </Btn>
          </div>
          {error && <p style={{ color: COLORS.red, textAlign: 'center', fontSize: '14px', marginBottom: 8 }}>{error}</p>}
          {loading && <p style={{ color: COLORS.smoke, textAlign: 'center', fontSize: '14px' }}>Connecting to the underworld...</p>}
          <Card style={{ marginTop: 16 }}>
            <p style={{ color: COLORS.smoke, fontSize: '13px', lineHeight: 1.7, textAlign: 'center' }}>
              2–12 players • Mafia, Detectives, Doctors &amp; more<br />
              Online multiplayer or pass one phone around
            </p>
          </Card>
        </Screen>
      </>
    );
  }

  if (screen === 'pass_setup') {
    return (
      <>
        <style>{GLOBAL_STYLE}</style>
        <PassSetup onStart={startPP} />
      </>
    );
  }

  if (screen === 'pass_game' && ppGame) {
    return (
      <>
        <style>{GLOBAL_STYLE}</style>
        <PPGameScreen game={ppGame} setGame={g => { setPPGame(g); ppGameRef.current = g; }} />
      </>
    );
  }

  if (screen === 'lobby' && room) {
    return (
      <>
        <style>{GLOBAL_STYLE}</style>
        <OnlineLobby
          room={room} myId={myId} isHost={room.hostId === myId}
          onRoomUpdate={async r => { await saveRoom(r); setRoom(r); }}
          onStart={startOnlineGame}
        />
      </>
    );
  }

  if (screen === 'online_game' && room) {
    if (room.winner) {
      return (
        <>
          <style>{GLOBAL_STYLE}</style>
          <GameOverScreen room={room} myId={myId} onPlayAgain={() => { clearInterval(pollRef.current); setRoom(null); setScreen('home'); }} />
        </>
      );
    }
    return (
      <>
        <style>{GLOBAL_STYLE}</style>
        <OnlineGame
          room={room} myId={myId} myName={myName}
          onRoomUpdate={async r => { await saveRoom(r); setRoom(r); }}
        />
      </>
    );
  }

  return null;
}

export default AppRoot;
