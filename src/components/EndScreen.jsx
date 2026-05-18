import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

const TEAM_COLORS = [
  'from-purple-500 to-pink-500',
  'from-blue-500 to-cyan-500',
  'from-green-500 to-emerald-500',
  'from-orange-500 to-yellow-500',
  'from-red-500 to-pink-600',
  'from-indigo-500 to-purple-600',
];

const MEDALS = ['🥇', '🥈', '🥉'];
const PLACE_LABELS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

export default function EndScreen({ scores, teams, onPlayAgain }) {
  const firedRef = useRef(false);

  const ranked = teams
    .map((name, i) => ({ name, score: scores[name] ?? 0, origIdx: i }))
    .sort((a, b) => b.score - a.score);

  const winner = ranked[0];

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    const duration = 4000;
    const end = Date.now() + duration;

    const colors = ['#a855f7', '#ec4899', '#f59e0b', '#22c55e', '#3b82f6'];

    function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    }

    frame();

    // Big burst at start
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.5 },
      colors,
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10 animate-bounce-in">
        <div className="text-7xl mb-4">🏆</div>
        <h1 className="font-fredoka text-5xl md:text-7xl gradient-text mb-2">
          Game Over!
        </h1>
        <p className="text-purple-200 text-2xl font-bold">
          🎉 {winner.name} wins with {winner.score} points! 🎉
        </p>
      </div>

      {/* Results */}
      <div className="w-full max-w-md space-y-3 animate-slide-in">
        {ranked.map((team, place) => (
          <div
            key={team.name}
            className={`card-glass rounded-2xl px-6 py-4 flex items-center gap-4 border-2
              ${place === 0 ? 'border-yellow-400 bg-yellow-400/10' : 'border-white/10'}`}
            style={{ animationDelay: `${place * 0.1}s` }}
          >
            {/* Medal / place */}
            <div className="text-3xl min-w-[40px] text-center">
              {MEDALS[place] ?? PLACE_LABELS[place]}
            </div>

            {/* Color dot */}
            <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${TEAM_COLORS[team.origIdx]} flex-shrink-0`} />

            {/* Name */}
            <div className="flex-1 font-bold text-white text-xl truncate">{team.name}</div>

            {/* Score */}
            <div className={`font-fredoka text-3xl ${place === 0 ? 'text-yellow-300' : 'text-white'}`}>
              {team.score}
            </div>
          </div>
        ))}
      </div>

      {/* Play Again */}
      <button
        onClick={onPlayAgain}
        className="btn-primary mt-10 px-12 py-5 rounded-2xl text-white font-fredoka text-3xl animate-pulse-glow"
      >
        🔄 Play Again!
      </button>

      <p className="mt-6 text-purple-400 text-sm">Thanks for playing the 90s Music Quiz! 🎵</p>
    </div>
  );
}
