# 🎵 90s Music Guessing Party Game

A fun party game where teams compete to guess 90s songs from audio snippets powered by the YouTube IFrame API.

## Features

- 2–6 teams with custom names
- 1–20 randomised rounds
- Hidden YouTube audio playback (audio-only guessing experience)
- Steal mechanics — other teams can attempt after a pass
- Live scoreboard with score pop animations
- Confetti celebration on the end screen
- Mobile-friendly, big-screen optimised UI

---

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Deploy to Vercel (Free)

### Option 1 — Vercel CLI (fastest)

```bash
# Install Vercel CLI globally (once)
npm install -g vercel

# From the project directory:
vercel

# Follow the prompts:
#   Set up and deploy? → Y
#   Which scope? → your account
#   Link to existing project? → N
#   Project name? → music-game (or whatever you like)
#   In which directory is your code? → ./
#   Want to override settings? → N

# Vercel will auto-detect Vite and deploy.
# Your live URL is printed at the end 🎉
```

For subsequent deploys:
```bash
vercel --prod
```

### Option 2 — GitHub + Vercel Dashboard

1. Push this repo to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USER/music-game.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your GitHub repo.
3. Vercel auto-detects Vite. No extra config needed — `vercel.json` is already included.
4. Click **Deploy**. Done! 🚀

---

## How to Play

1. **Setup** — Host enters team names and number of rounds.
2. **Game** — Host clicks **▶️ Play Snippet** to start the audio. Teams shout the answer.
3. **Correct** — Host taps ✅ to award 10 points and move on.
4. **Pass / Wrong** — Other teams get a steal attempt in order. If nobody gets it, the answer is revealed.
5. **End** — Final scores with confetti. Tap 🔄 Play Again to restart.

---

## Tech Stack

- [React](https://react.dev) + [Vite](https://vite.dev)
- [Tailwind CSS v4](https://tailwindcss.com)
- [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference)
- [canvas-confetti](https://github.com/catdad/canvas-confetti)
