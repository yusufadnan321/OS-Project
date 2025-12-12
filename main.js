const { useState, useEffect, useRef } = React;

// Quantum for foreground (ms)
const QUANTUM = 4;

function defaultProcesses() {
  return [
    { id: 1, name: 'P1', arrival: 0, burst: 6, remaining: 6, type: 'foreground' },
    { id: 2, name: 'P2', arrival: 1, burst: 8, remaining: 8, type: 'background' },
    { id: 3, name: 'P3', arrival: 2, burst: 4, remaining: 4, type: 'foreground' },
    { id: 4, name: 'P4', arrival: 3, burst: 10, remaining: 10, type: 'background' },
  ];
}

function simulate(processList) {
  // Deep copy and init
  const processes = processList.map(p => ({ ...p, remaining: p.burst }));
  const n = processes.length;
  const byArrival = [...processes].sort((a, b) => a.arrival - b.arrival || a.id - b.id);

  let time = 0;
  let timeline = []; // array of { pid, name, type, start, end }
  let fgQueue = [];
  let bgQueue = [];
  let current = null;
  let fgSliceCounter = 0;
  let finishedCount = 0;

  const totalBurst = processes.reduce((s, p) => s + p.burst, 0);
  const lastArrival = Math.max(...processes.map(p => p.arrival), 0);
  const maxTime = totalBurst + lastArrival + 1000; // safeguard

  // Helper to push a timeline ms (we merge contiguous segments later)
  const pushExec = (pid, name, type, t) => {
    if (timeline.length === 0) {
      timeline.push({ pid, name, type, start: t, end: t + 1 });
    } else {
      const last = timeline[timeline.length - 1];
      if (last.pid === pid) {
        last.end = t + 1;
      } else {
        timeline.push({ pid, name, type, start: t, end: t + 1 });
      }
    }
  };

  // track which processes have been enqueued
  const enqueued = new Set();

  while (finishedCount < n && time < maxTime) {
    // enqueue arrivals at current time
    for (const p of byArrival) {
      if (p.arrival === time && !enqueued.has(p.id)) {
        enqueued.add(p.id);
        const proc = processes.find(x => x.id === p.id);
        if (proc.type === 'foreground') fgQueue.push(proc);
        else bgQueue.push(proc);
      }
    }

    // Preempt background if a foreground job is available
    if (current && current.type === 'background' && fgQueue.length > 0) {
      // preempt background process immediately
      bgQueue.unshift(current); // push to front to preserve FCFS order for remainder
      current = null;
    }

    if (!current) {
      if (fgQueue.length > 0) {
        current = fgQueue.shift();
        fgSliceCounter = 0;
        if (!current._startTimes) current._startTimes = [];
        current._startTimes.push(time);
      } else if (bgQueue.length > 0) {
        current = bgQueue.shift();
        if (!current._startTimes) current._startTimes = [];
        current._startTimes.push(time);
      }
    }

    if (current) {
      // execute 1ms
      pushExec(current.id, current.name, current.type, time);
      current.remaining -= 1;

      if (current.type === 'foreground') fgSliceCounter += 1;

      time += 1;

      // Check finish
      if (current.remaining <= 0) {
        current._finish = time;
        finishedCount += 1;
        current = null;
        fgSliceCounter = 0;
        continue;
      }

      // If foreground and quantum expired -> move to end of fgQueue
      if (current.type === 'foreground' && fgSliceCounter >= QUANTUM) {
        fgQueue.push(current);
        current = null;
        fgSliceCounter = 0;
        continue;
      }

      // If background, it's allowed to run until preempted by a foreground arrival
      // (preemption handled at top of loop after arrival enqueue)
    } else {
      // idle: if nothing to run, just advance time to next arrival if exists
      const nextArrival = byArrival.find(p => !enqueued.has(p.id));
      if (nextArrival) time = Math.max(time + 1, nextArrival.arrival);
      else break; // nothing left
    }
  }

  // Merge adjacent timeline already handled by pushExec
  // Compute stats per process
  const stats = processes.map(p => {
    const finish = p._finish ?? null;
    const turnaround = finish !== null ? finish - p.arrival : null;
    // waiting time = turnaround - burst (if finished)
    const waiting = turnaround !== null ? turnaround - p.burst : null;
    return { id: p.id, name: p.name, arrival: p.arrival, burst: p.burst, finish, turnaround, waiting, type: p.type };
  });

  return { timeline, stats, totalTime: time };
}

function colorFor(type, pid) {
  if (type === 'foreground') return 'bg-blue-500';
  return 'bg-green-600';
}

function Gantt({ timeline, scale = 20 }) {
  if (!timeline || timeline.length === 0) return <div className="text-sm text-gray-600">No timeline yet</div>;
  const total = timeline.reduce((s, seg) => Math.max(s, seg.end), 0);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="text-sm text-gray-700">Timeline (ms)</div>
        <div className="text-xs text-gray-500">scale: {scale}px/ms</div>
      </div>
      <div className="w-full bg-white p-3 rounded shadow">
        <div className="flex items-start gap-2">
          {timeline.map((seg, idx) => {
            const width = (seg.end - seg.start) * scale;
            return (
              <div key={idx} className={`flex items-center justify-center text-white text-sm ${colorFor(seg.type, seg.pid)}`} style={{ width: width + 'px', height: '40px' }} title={`${seg.name} (${seg.start}-${seg.end})`}>
                {seg.name}
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-xs text-gray-500 flex gap-4">
          <div>Total time: {total} ms</div>
        </div>
      </div>
    </div>
  );
}

function ProcessForm({ onAdd }) {
  const [name, setName] = useState('');
  const [arrival, setArrival] = useState(0);
  const [burst, setBurst] = useState(1);
  const [type, setType] = useState('foreground');

  const handleAdd = () => {
    if (!name) return alert('Enter process name');
    const p = { id: Date.now(), name, arrival: Number(arrival), burst: Number(burst), remaining: Number(burst), type };
    onAdd(p);
    setName('');
    setArrival(0);
    setBurst(1);
  };

  return (
    <div className="bg-white p-4 rounded shadow">
      <div className="grid grid-cols-4 gap-3">
        <input className="col-span-1 p-2 border rounded" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <input type="number" min="0" className="p-2 border rounded" placeholder="Arrival" value={arrival} onChange={e => setArrival(e.target.value)} />
        <input type="number" min="1" className="p-2 border rounded" placeholder="Burst" value={burst} onChange={e => setBurst(e.target.value)} />
        <select className="p-2 border rounded" value={type} onChange={e => setType(e.target.value)}>
          <option value="foreground">Foreground (RR, q=4ms)</option>
          <option value="background">Background (FCFS)</option>
        </select>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={handleAdd}>Add Process</button>
      </div>
    </div>
  );
}

function App() {
  const [processes, setProcesses] = useState(defaultProcesses());
  const [timeline, setTimeline] = useState([]);
  const [stats, setStats] = useState([]);
  const [scale, setScale] = useState(24);
  const nextId = useRef(1000);

  useEffect(() => {
    // reset remaining when processes change
    setProcesses(prev => prev.map(p => ({ ...p, remaining: p.burst })));
  }, []);

  const addProcess = (p) => {
    setProcesses(prev => [...prev, { ...p, id: nextId.current++ }]);
  };

  const runSim = () => {
    if (processes.length === 0) return alert('Add some processes first');
    // ensure numeric fields
    const cleaned = processes.map((p, idx) => ({ id: p.id ?? idx + 1, name: p.name ?? `P${idx + 1}`, arrival: Number(p.arrival), burst: Number(p.burst), remaining: Number(p.burst), type: p.type ?? 'foreground' }));
    const res = simulate(cleaned);
    setTimeline(res.timeline);
    setStats(res.stats);
  };

  const reset = () => {
    setProcesses(defaultProcesses());
    setTimeline([]);
    setStats([]);
  };

  const removeProcess = (id) => {
    setProcesses(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Multi-Level Queue Scheduling Simulator</h1>
        <p className="text-sm text-gray-600">Two queues: Foreground (Round Robin, quantum = 4ms) and Background (FCFS). Foreground processes have strict priority and preempt background work.</p>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          <ProcessForm onAdd={addProcess} />

          <div className="bg-white p-4 rounded shadow">
            <div className="flex justify-between items-center mb-2">
              <div className="font-medium">Processes</div>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-gray-200 rounded" onClick={reset}>Reset</button>
                <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={runSim}>Run Simulation</button>
              </div>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th className="p-2">Name</th>
                    <th>Type</th>
                    <th>Arrival</th>
                    <th>Burst</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {processes.map(p => (
                    <tr key={p.id} className="border-t">
                      <td className="p-2">{p.name}</td>
                      <td className="p-2">{p.type}</td>
                      <td className="p-2">{p.arrival}</td>
                      <td className="p-2">{p.burst}</td>
                      <td className="p-2 text-right"><button className="text-red-600" onClick={() => removeProcess(p.id)}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white p-4 rounded shadow">
            <div className="flex justify-between items-center mb-2">
              <div className="font-medium">Gantt Chart</div>
              <div className="text-sm text-gray-600">Scale: <input type="range" min="8" max="32" value={scale} onChange={e => setScale(Number(e.target.value))} /></div>
            </div>
            <Gantt timeline={timeline} scale={scale} />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="bg-white p-4 rounded shadow">
            <div className="font-medium mb-2">Statistics</div>
            <div className="text-sm text-gray-700">
              {stats.length === 0 ? <div>No stats yet. Run simulation.</div> : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500">
                    <tr><th className="p-1">Name</th><th>Finish</th><th>Turnaround</th><th>Waiting</th></tr>
                  </thead>
                  <tbody>
                    {stats.map(s => (
                      <tr key={s.id} className="border-t">
                        <td className="p-1">{s.name}</td>
                        <td className="p-1">{s.finish ?? '-'}</td>
                        <td className="p-1">{s.turnaround ?? '-'}</td>
                        <td className="p-1">{s.waiting ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="bg-white p-4 rounded shadow text-sm text-gray-700">
            <div className="font-medium mb-2">Notes / Assumptions</div>
            <ul className="list-disc ml-4">
              <li>Foreground: Round Robin, quantum = 4ms.</li>
              <li>Background: FCFS, but preempted immediately if any foreground process arrives (to prioritize interactive jobs).</li>
              <li>Simulation runs in 1ms steps for accuracy and clarity.</li>
            </ul>
          </div>
        </aside>
      </div>

      <footer className="mt-6 text-xs text-gray-500">
        Tip: add processes and click "Run Simulation". Use the scale slider to zoom the Gantt.
      </footer>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
