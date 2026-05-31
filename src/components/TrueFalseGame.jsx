import { useState, useEffect } from 'react';
import { getRandomQuestions } from '../data/questions';
import confetti from 'canvas-confetti';

const TOTAL_QUESTIONS = 10;

function StartScreen({ onStart }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-10 max-w-md w-full text-center shadow-2xl border border-white/20">
        <div className="text-7xl mb-6">🧠</div>
        <h1 className="text-4xl font-bold text-white mb-3">True or False?</h1>
        <p className="text-white/70 text-lg mb-8">
          10 questions per round. Score points for every correct answer. How well do you know the world?
        </p>
        <button
          onClick={onStart}
          className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold py-4 px-8 rounded-2xl text-xl transition-all duration-200 shadow-lg hover:shadow-pink-500/30 hover:scale-105 active:scale-95"
        >
          Start Game
        </button>
      </div>
    </div>
  );
}

function ResultScreen({ score, total, onRestart }) {
  const pct = Math.round((score / total) * 100);

  useEffect(() => {
    if (score >= total * 0.7) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }
  }, []);

  const grade =
    pct === 100 ? { label: 'Perfect!', emoji: '🏆', color: 'text-yellow-300' } :
    pct >= 80  ? { label: 'Excellent!', emoji: '🌟', color: 'text-green-300' } :
    pct >= 60  ? { label: 'Good Job!', emoji: '👍', color: 'text-blue-300' } :
    pct >= 40  ? { label: 'Keep Trying!', emoji: '💪', color: 'text-orange-300' } :
                 { label: 'Better Luck Next Time!', emoji: '😅', color: 'text-red-300' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-10 max-w-md w-full text-center shadow-2xl border border-white/20">
        <div className="text-7xl mb-4">{grade.emoji}</div>
        <h2 className={`text-3xl font-bold mb-2 ${grade.color}`}>{grade.label}</h2>
        <p className="text-white/60 mb-6 text-lg">Round complete</p>

        <div className="bg-white/10 rounded-2xl p-6 mb-8">
          <div className="text-6xl font-bold text-white mb-1">
            {score}<span className="text-3xl text-white/50">/{total}</span>
          </div>
          <div className="text-white/60 text-lg">{pct}% correct</div>
        </div>

        <div className="w-full bg-white/10 rounded-full h-3 mb-8">
          <div
            className="bg-gradient-to-r from-pink-500 to-purple-500 h-3 rounded-full transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>

        <button
          onClick={onRestart}
          className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold py-4 px-8 rounded-2xl text-xl transition-all duration-200 shadow-lg hover:scale-105 active:scale-95"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}

export default function TrueFalseGame() {
  const [phase, setPhase] = useState('start'); // start | playing | result
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null); // null | true | false
  const [answered, setAnswered] = useState(false);

  function startGame() {
    setQuestions(getRandomQuestions(TOTAL_QUESTIONS));
    setCurrent(0);
    setScore(0);
    setSelected(null);
    setAnswered(false);
    setPhase('playing');
  }

  function handleAnswer(choice) {
    if (answered) return;
    setSelected(choice);
    setAnswered(true);
    if (choice === questions[current].answer) {
      setScore(s => s + 1);
    }
  }

  function handleNext() {
    const next = current + 1;
    if (next >= TOTAL_QUESTIONS) {
      setPhase('result');
    } else {
      setCurrent(next);
      setSelected(null);
      setAnswered(false);
    }
  }

  if (phase === 'start') return <StartScreen onStart={startGame} />;
  if (phase === 'result') return <ResultScreen score={score} total={TOTAL_QUESTIONS} onRestart={startGame} />;

  const q = questions[current];
  const correct = q.answer;

  function btnClass(value) {
    const base = "flex-1 py-5 px-6 rounded-2xl font-bold text-xl transition-all duration-200 border-2 flex items-center justify-center gap-3 ";
    if (!answered) {
      return base + "bg-white/10 border-white/20 text-white hover:bg-white/20 hover:scale-105 active:scale-95 cursor-pointer";
    }
    if (value === correct) {
      return base + "bg-green-500/30 border-green-400 text-green-200 scale-105";
    }
    if (value === selected && value !== correct) {
      return base + "bg-red-500/30 border-red-400 text-red-200";
    }
    return base + "bg-white/5 border-white/10 text-white/40";
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-white/20">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-white/60 font-medium">
            Question {current + 1} of {TOTAL_QUESTIONS}
          </span>
          <span className="bg-white/20 text-white font-bold px-4 py-1 rounded-full text-sm">
            Score: {score}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-white/10 rounded-full h-2 mb-8">
          <div
            className="bg-gradient-to-r from-pink-500 to-purple-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${((current) / TOTAL_QUESTIONS) * 100}%` }}
          />
        </div>

        {/* Question */}
        <div className="bg-white/10 rounded-2xl p-6 mb-8 min-h-[120px] flex items-center">
          <p className="text-white text-xl font-medium leading-relaxed text-center w-full">
            {q.question}
          </p>
        </div>

        {/* Choices */}
        <div className="flex gap-4 mb-6">
          <button className={btnClass(true)} onClick={() => handleAnswer(true)}>
            <span className="text-2xl">✓</span> True
          </button>
          <button className={btnClass(false)} onClick={() => handleAnswer(false)}>
            <span className="text-2xl">✗</span> False
          </button>
        </div>

        {/* Feedback + Next */}
        {answered && (
          <div className="space-y-4">
            <div className={`text-center py-3 rounded-xl font-semibold text-lg ${selected === correct ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
              {selected === correct
                ? '🎉 Correct!'
                : `❌ Wrong! The answer is ${correct ? 'True' : 'False'}.`}
            </div>
            <button
              onClick={handleNext}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold py-3 px-8 rounded-2xl text-lg transition-all duration-200 hover:scale-105 active:scale-95"
            >
              {current + 1 < TOTAL_QUESTIONS ? 'Next Question →' : 'See Results'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
