import { useState, useEffect, useRef } from 'react';

const POINTS = 10;
const TEAM_COLORS = [
  'from-purple-500 to-pink-500',
  'from-blue-500 to-cyan-500',
  'from-green-500 to-emerald-500',
  'from-orange-500 to-yellow-500',
  'from-red-500 to-pink-600',
  'from-indigo-500 to-purple-600',
];
const TEAM_BORDER_COLORS = [
  'border-purple-500', 'border-blue-500', 'border-green-500',
  'border-orange-500', 'border-red-500',  'border-indigo-500',
];

function embedSrc(videoId) {
  return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=0&controls=1&rel=0&modestbranding=1&origin=${window.location.origin}`;
}

export default function GameScreen({ songs, teams, onGameEnd }) {
  const [songIdx, setSongIdx]       = useState(0);
  const [scores, setScores]         = useState(() => Object.fromEntries(teams.map(t => [t, 0])));
  const [phase, setPhase]           = useState('playing');
  const [activeTeamIdx, setActiveTeamIdx] = useState(0);
  const [stealOrder, setStealOrder] = useState([]);
  const [stealIdx, setStealIdx]     = useState(0);
  const [winner, setWinner]         = useState(null);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [elapsed, setElapsed]       = useState(0);
  const [popTeam, setPopTeam]       = useState(null);
  const [readyIds, setReadyIds]     = useState(new Set());
  const [errorIds, setErrorIds]     = useState(new Set());
  const [skipping, setSkipping]     = useState(false);

  const iframeRefs   = useRef({});
  const timerRef     = useRef(null);
  const startTimeRef = useRef(null);

  const song       = songs[songIdx];
  const totalSongs = songs.length;
  // Preload next song in background (skip already-errored ones)
  const nextSong   = songs.slice(songIdx + 1).find(s => !errorIds.has(s.youtubeId));
  const playerReady = readyIds.has(song?.youtubeId);

  function matchSource(source) {
    return Object.entries(iframeRefs.current).find(([, el]) => el?.contentWindow === source);
  }
  function markReady(id)  { setReadyIds(p  => new Set([...p, id])); }
  function markError(id)  { setErrorIds(p  => new Set([...p, id])); }

  // Auto-skip unavailable videos
  useEffect(() => {
    if (!song || !errorIds.has(song.youtubeId)) return;
    setSkipping(true);
    const t = setTimeout(() => {
      setSkipping(false);
      const next = songs.findIndex((s, i) => i > songIdx && !errorIds.has(s.youtubeId));
      if (next === -1) onGameEnd(scores);
      else setSongIdx(next); // same team keeps their turn
    }, 1200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorIds, songIdx]);

  // YouTube postMessage listener
  useEffect(() => {
    function onMessage(e) {
      if (!e.data) return;
      let d;
      try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
      if (!d?.event) return;
      const entry = matchSource(e.source);
      if (!entry) return;
      const [videoId] = entry;
      if (d.event === 'onReady')       markReady(videoId);
      if (d.event === 'onError')       markError(videoId);
      if (d.event === 'onStateChange') {
        if (d.info === 1) setIsPlaying(true);   // playing
        if (d.info === 2 || d.info === 0) setIsPlaying(false); // paused / ended
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Timer
  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = Date.now() - elapsed * 1000;
      timerRef.current = setInterval(() =>
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 200);
    } else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // Reset round state on song change
  useEffect(() => {
    setPhase('playing'); setStealOrder([]); setStealIdx(0);
    setWinner(null); setElapsed(0); setIsPlaying(false);
  }, [songIdx]);

  function ytCmd(videoId, func) {
    iframeRefs.current[videoId]?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args: [] }), '*'
    );
  }
  function stopAudio() { ytCmd(song.youtubeId, 'pauseVideo'); setIsPlaying(false); }

  function triggerScorePop(team) {
    setPopTeam(team); setTimeout(() => setPopTeam(null), 700);
  }

  function handleCorrect() {
    const guesser = phase === 'stealing' ? stealOrder[stealIdx] : teams[activeTeamIdx];
    setScores(p => ({ ...p, [guesser]: p[guesser] + POINTS }));
    triggerScorePop(guesser);
    setWinner(guesser);
    stopAudio();
    setPhase('revealed');
  }

  function handlePass() {
    stopAudio();
    if (phase === 'playing') {
      const others = teams.map((t, i) => ({ t, i })).filter(({ i }) => i !== activeTeamIdx).map(({ t }) => t);
      setStealOrder(others); setStealIdx(0); setPhase('stealing');
    } else if (phase === 'stealing') {
      stealIdx + 1 < stealOrder.length
        ? setStealIdx(i => i + 1)
        : (setWinner(null), setPhase('revealed'));
    }
  }

  function handleNextSong() {
    if (songIdx + 1 >= totalSongs) { onGameEnd(scores); return; }
    const next = songs.findIndex((s, i) => i > songIdx && !errorIds.has(s.youtubeId));
    if (next === -1) { onGameEnd(scores); return; }
    setSongIdx(next);
    setActiveTeamIdx(i => (i + 1) % teams.length);
  }

  const currentGuesser    = phase === 'stealing' ? stealOrder[stealIdx] : teams[activeTeamIdx];
  const currentGuesserIdx = teams.indexOf(currentGuesser);
  const formatTime = s => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const isError = errorIds.has(song?.youtubeId);

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 max-w-5xl mx-auto">

      {/* Current song iframe — visible so host can control it and we can see embed errors */}
      {song && (
        <div className="mb-4 rounded-2xl overflow-hidden border border-white/10 bg-black/30">
          <div className="flex items-center gap-3 px-4 py-2 text-xs font-mono border-b border-white/10">
            <span className="text-purple-400 font-bold">🎵 NOW PLAYING</span>
            <span className="text-white/50">{song.film}</span>
            <a href={`https://www.youtube.com/watch?v=${song.youtubeId}`}
               target="_blank" rel="noopener noreferrer"
               className="text-cyan-400 underline hover:text-cyan-200 ml-1">
              {song.youtubeId} ↗
            </a>
            <span className={`ml-auto font-bold ${isError ? 'text-red-400' : playerReady ? 'text-green-400' : 'text-yellow-400 animate-pulse'}`}>
              {isError ? '✕ unavailable — skipping…' : playerReady ? '● ready' : '○ loading…'}
            </span>
          </div>
          <iframe
            key={song.youtubeId}
            ref={el => { if (el) iframeRefs.current[song.youtubeId] = el; else delete iframeRefs.current[song.youtubeId]; }}
            src={embedSrc(song.youtubeId)}
            allow="autoplay; encrypted-media"
            onLoad={() => setTimeout(() => markReady(song.youtubeId), 800)}
            style={{ display: 'block', width: '100%', height: 160, border: 'none' }}
            title={`yt-${song.youtubeId}`}
          />
        </div>
      )}

      {/* Preload next song silently */}
      {nextSong && (
        <iframe
          key={`pre-${nextSong.youtubeId}`}
          ref={el => { if (el) iframeRefs.current[nextSong.youtubeId] = el; else delete iframeRefs.current[nextSong.youtubeId]; }}
          src={embedSrc(nextSong.youtubeId)}
          allow="autoplay; encrypted-media"
          onLoad={() => setTimeout(() => markReady(nextSong.youtubeId), 800)}
          onError={() => markError(nextSong.youtubeId)}
          style={{ position: 'fixed', left: '-9999px', width: 320, height: 180, opacity: 0.01, border: 'none', pointerEvents: 'none' }}
          title={`yt-pre-${nextSong.youtubeId}`}
        />
      )}

      {/* Skip banner */}
      {skipping && (
        <div className="mb-4 rounded-xl bg-yellow-500/20 border border-yellow-400/40 px-4 py-3 text-center text-yellow-300 font-bold animate-pulse">
          ⏭️ Video unavailable — skipping…
        </div>
      )}

      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="card-glass rounded-2xl px-5 py-3">
          <span className="text-purple-300 text-sm font-bold uppercase tracking-wider">Round</span>
          <div className="font-fredoka text-3xl text-white">
            {songIdx + 1} <span className="text-purple-400 text-xl">/ {totalSongs}</span>
          </div>
        </div>
        <div className="text-center animate-float">
          <div className="text-4xl">🎵</div>
          <div className="text-purple-300 text-xs font-bold uppercase tracking-wider mt-1">Bollywood Quiz</div>
        </div>
        <div className="card-glass rounded-2xl px-5 py-3 text-center">
          <span className="text-purple-300 text-sm font-bold uppercase tracking-wider">Timer</span>
          <div className="font-fredoka text-3xl" style={{ color: isPlaying ? '#fde047' : '#fff', animation: isPlaying ? 'timer-pulse 1s ease-in-out infinite' : 'none' }}>
            {formatTime(elapsed)}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1">
        {/* Left */}
        <div className="flex-1 flex flex-col gap-4">

          {/* Team Banner */}
          {phase !== 'revealed' && (
            <div className={`card-glass rounded-3xl p-6 text-center animate-slide-in border-2 ${TEAM_BORDER_COLORS[currentGuesserIdx] ?? 'border-purple-500'}`}>
              {phase === 'stealing' && <div className="text-yellow-300 font-bold text-lg mb-1 uppercase tracking-wider">🔥 Steal Attempt!</div>}
              <div className="text-purple-200 text-lg font-bold mb-2">
                {phase === 'stealing' ? 'Stealing team:' : "It's your turn!"}
              </div>
              <div className={`font-fredoka text-4xl md:text-5xl bg-gradient-to-r ${TEAM_COLORS[currentGuesserIdx] ?? TEAM_COLORS[0]} bg-clip-text text-transparent`}>
                {currentGuesser}
              </div>
              {phase === 'playing' && <div className="text-purple-300 text-sm mt-2">Name the song + film! 🎤</div>}
            </div>
          )}

          {/* Reveal Card */}
          {phase === 'revealed' && (
            <div className="reveal-card rounded-3xl p-8 text-center animate-bounce-in">
              <div className="text-5xl mb-3">{winner ? '🎉' : '😅'}</div>
              {winner
                ? <div className="text-white font-bold text-xl mb-4"><span className="text-yellow-200 font-fredoka text-2xl">{winner}</span> got it! +{POINTS} pts</div>
                : <div className="text-white font-bold text-xl mb-4">Nobody got it! 😬</div>
              }
              <div className="text-white/80 text-sm uppercase tracking-wider font-bold mb-1">The song was</div>
              <div className="text-white font-fredoka text-3xl md:text-4xl mb-1">{song.title}</div>
              <div className="text-yellow-200 text-xl font-semibold">{song.artist}</div>
              <div className="text-white/60 text-sm mt-1">from <em>{song.film}</em></div>
              <button onClick={handleNextSong} className="btn-next mt-6 px-10 py-4 rounded-2xl text-white font-fredoka text-2xl">
                {songIdx + 1 >= totalSongs ? '🏆 See Results!' : '➡️ Next Song'}
              </button>
            </div>
          )}

          {/* Controls */}
          {phase !== 'revealed' && (
            <div className="card-glass rounded-3xl p-6">
              <div className="text-center text-purple-300/70 text-xs mb-4 uppercase tracking-wider font-bold">
                ☝️ Use the player above to play/stop — then tap correct or pass
              </div>
              <div className="flex gap-4">
                <button onClick={handleCorrect} className="btn-correct flex-1 py-4 rounded-2xl text-white font-fredoka text-2xl">✅ Correct!</button>
                <button onClick={handlePass}    className="btn-pass    flex-1 py-4 rounded-2xl text-white font-fredoka text-2xl">
                  {phase === 'stealing' && stealIdx + 1 >= stealOrder.length ? '❌ Reveal' : '❌ Pass / Wrong'}
                </button>
              </div>
              {phase === 'stealing' && (
                <div className="mt-3 text-center text-yellow-300 text-sm font-bold">
                  Steal {stealIdx + 1} of {stealOrder.length} — {stealOrder.length - stealIdx - 1} left
                </div>
              )}
              {/* Skip Song */}
              <div className="mt-3 flex justify-center">
                <button
                  onClick={handleNextSong}
                  className="px-6 py-2 rounded-xl text-white/60 text-sm font-bold hover:text-white/90 hover:bg-white/10 transition-all cursor-pointer"
                >
                  ⏭️ Skip Song
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scoreboard */}
        <div className="lg:w-72">
          <div className="card-glass rounded-3xl p-5 sticky top-6">
            <div className="text-center text-purple-200 font-bold uppercase tracking-wider text-sm mb-4">🏆 Scoreboard</div>
            <div className="flex flex-col gap-3">
              {teams.map((t, i) => ({ name: t, score: scores[t], idx: i }))
                .sort((a, b) => b.score - a.score)
                .map(({ name, score, idx }) => {
                  const isActive   = name === currentGuesser && phase !== 'revealed';
                  const isStealing = phase === 'stealing' && name === currentGuesser;
                  return (
                    <div key={name} className={`scoreboard-row rounded-2xl px-4 py-3 border-2 flex items-center justify-between
                      ${isActive ? 'active-team' : 'border-white/10 bg-white/5'} ${isStealing ? 'stealing-team' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${TEAM_COLORS[idx]}`} />
                        <span className="text-white font-bold text-base truncate max-w-[120px]">{name}</span>
                        {isActive && <span className="text-xs">{isStealing ? '🔥' : '👈'}</span>}
                      </div>
                      <span className={`font-fredoka text-2xl ${popTeam === name ? 'animate-score-pop text-yellow-300' : 'text-white'}`}>{score}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
