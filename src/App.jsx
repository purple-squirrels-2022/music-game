import { useState } from 'react';
import SetupScreen from './components/SetupScreen';
import GameScreen from './components/GameScreen';
import EndScreen from './components/EndScreen';
import { shuffleAndPick } from './data/songs';

export default function App() {
  const [screen, setScreen] = useState('setup');
  const [config, setConfig] = useState(null);
  const [songs, setSongs] = useState([]);
  const [finalScores, setFinalScores] = useState(null);

  function handleStart({ teams, rounds, activeTags }) {
    const picked = shuffleAndPick(rounds, activeTags);
    setSongs(picked);
    setConfig({ teams, rounds });
    setFinalScores(null);
    setScreen('game');
  }

  function handleGameEnd(scores) {
    setFinalScores(scores);
    setScreen('end');
  }

  function handlePlayAgain() {
    setScreen('setup');
    setConfig(null);
    setSongs([]);
    setFinalScores(null);
  }

  return (
    <>
      {screen === 'setup' && <SetupScreen onStart={handleStart} />}
      {screen === 'game' && config && (
        <GameScreen
          songs={songs}
          teams={config.teams}
          onGameEnd={handleGameEnd}
        />
      )}
      {screen === 'end' && config && finalScores && (
        <EndScreen
          scores={finalScores}
          teams={config.teams}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </>
  );
}
