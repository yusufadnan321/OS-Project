# Multi-Level Queue Scheduling Simulator

This is an interactive simulator demonstrating a Multi-Level Queue Scheduling algorithm with two queues:

- Queue 1: Foreground (High priority)
  - Interactive processes
  - Round Robin (quantum = 4 ms)
- Queue 2: Background (Low priority)
  - Batch processes
  - FCFS (First-Come-First-Serve)

The simulator in this folder has been converted to a Vite + React project with Tailwind CSS.

## Setup & Run (PowerShell)

From the project root `c:\Users\Abir\Desktop\OS` run:

```powershell
npm install
npm run dev
```

Open the address shown by Vite (typically `http://localhost:5173`) in your browser.

## Files

- `index.html` - Vite entry HTML
- `package.json` - project scripts and dependencies
- `vite.config.js` - Vite configuration
- `tailwind.config.cjs`, `postcss.config.cjs` - Tailwind setup
- `src/main.jsx` - React entry
- `src/App.jsx` - Simulator app and UI
- `src/index.css` - Tailwind imports

## Notes

- Foreground: Round Robin, quantum = 4ms.
- Background: FCFS but preempted immediately if a foreground process arrives (to prioritize interactivity). If you want non-preemptive background, I can change that.
- Simulation runs in 1ms steps for clarity.

If you want, I can:
- Add animation controls (play/pause/step)
- Add import/export for process lists
- Convert to TypeScript or add tests

