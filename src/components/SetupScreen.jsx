import { useState } from 'react';
import { ALL_SONGS, ALL_TAGS } from '../data/songs';

export default function SetupScreen({ onStart }) {
  const [numTeams, setNumTeams] = useState(2);
  const [teamNames, setTeamNames] = useState(['Team 1', 'Team 2', '', '', '', '']);
  const [rounds, setRounds] = useState(10);
  const [activeTags, setActiveTags] = useState([]); // empty = all songs

  // How many songs are available given the current tag filter
  const available = activeTags.length === 0
    ? ALL_SONGS.length
    : ALL_SONGS.filter(s => s.tags.some(t => activeTags.includes(t))).length;

  const maxRounds = available;
  const clampedRounds = Math.min(rounds, maxRounds);

  function toggleTag(id) {
    setActiveTags(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  }

  function handleNumTeams(n) {
    const count = Math.min(6, Math.max(2, Number(n)));
    setNumTeams(count);
    setTeamNames(prev => {
      const next = [...prev];
      for (let i = 0; i < 6; i++) if (!next[i]) next[i] = `Team ${i + 1}`;
      return next;
    });
  }

  function handleTeamName(i, val) {
    setTeamNames(prev => { const next = [...prev]; next[i] = val; return next; });
  }

  function handleStart() {
    const names = teamNames.slice(0, numTeams).map((n, i) => n.trim() || `Team ${i + 1}`);
    onStart({ teams: names, rounds: clampedRounds, activeTags });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">

      {/* Header */}
      <div className="text-center mb-10 animate-slide-in">
        <div className="text-6xl mb-4 animate-float">🎵</div>
        <h1 className="font-fredoka text-5xl md:text-7xl gradient-text mb-2">
          Bollywood Quiz
        </h1>
        <p className="text-purple-200 text-xl md:text-2xl font-semibold">
          Instrumental guessing game! 🎉
        </p>
      </div>

      <div className="card-glass rounded-3xl p-8 w-full max-w-lg animate-slide-in">

        {/* Song Category Filter */}
        <div className="mb-8">
          <label className="block text-white font-bold text-xl mb-1">
            🎛️ Song Categories
          </label>
          <p className="text-purple-300 text-sm mb-3">
            Pick moods to include — leave all off for every song
          </p>
          <div className="flex gap-3 flex-wrap">
            {ALL_TAGS.map(tag => {
              const active = activeTags.includes(tag.id);
              const count = ALL_SONGS.filter(s => s.tags.includes(tag.id)).length;
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`px-4 py-2 rounded-2xl font-bold text-sm transition-all duration-200 cursor-pointer border-2
                    ${active
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 border-purple-400 text-white scale-105 shadow-lg'
                      : 'bg-white/10 border-white/20 text-purple-200 hover:bg-white/20'}`}
                >
                  {tag.label}
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-white/10'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-purple-400 text-xs mt-2">
            {available} song{available !== 1 ? 's' : ''} available
          </p>
        </div>

        {/* Number of Rounds */}
        <div className="mb-8">
          <label className="block text-white font-bold text-xl mb-3">
            🎯 Number of Rounds
          </label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setRounds(r => Math.max(1, r - 1))}
              className="w-12 h-12 rounded-xl bg-white/10 text-white text-2xl font-bold hover:bg-white/20 transition-all cursor-pointer"
            >−</button>
            <div className="flex-1 text-center">
              <span className="font-fredoka text-5xl text-yellow-300">{clampedRounds}</span>
              <span className="text-purple-300 text-sm block">of {maxRounds} available</span>
            </div>
            <button
              onClick={() => setRounds(r => Math.min(maxRounds, r + 1))}
              className="w-12 h-12 rounded-xl bg-white/10 text-white text-2xl font-bold hover:bg-white/20 transition-all cursor-pointer"
            >+</button>
          </div>
        </div>

        {/* Number of Teams */}
        <div className="mb-8">
          <label className="block text-white font-bold text-xl mb-3">
            👥 Number of Teams
          </label>
          <div className="flex gap-3 justify-center">
            {[2, 3, 4, 5, 6].map(n => (
              <button
                key={n}
                onClick={() => handleNumTeams(n)}
                className={`w-14 h-14 rounded-2xl font-fredoka text-2xl font-bold transition-all duration-200 cursor-pointer
                  ${numTeams === n
                    ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg scale-110'
                    : 'bg-white/10 text-purple-200 hover:bg-white/20 hover:scale-105'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Team Names */}
        <div className="mb-8">
          <label className="block text-white font-bold text-xl mb-3">
            ✏️ Team Names
          </label>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: numTeams }).map((_, i) => (
              <input
                key={i}
                type="text"
                value={teamNames[i]}
                onChange={e => handleTeamName(i, e.target.value)}
                placeholder={`Team ${i + 1}`}
                maxLength={20}
              />
            ))}
          </div>
        </div>

        {/* Start */}
        <button
          onClick={handleStart}
          disabled={maxRounds === 0}
          className="btn-primary w-full py-5 rounded-2xl text-white font-fredoka text-3xl disabled:opacity-40 disabled:cursor-not-allowed"
        >
          🚀 Start Game!
        </button>
        {maxRounds === 0 && (
          <p className="text-red-400 text-center text-sm mt-2">No songs match the selected filters</p>
        )}
      </div>

      <div className="mt-8 text-purple-300 text-center text-sm max-w-md">
        <p>💡 <strong>Instrumental only</strong> — guess the song from the melody alone! 🎹</p>
      </div>
    </div>
  );
}
