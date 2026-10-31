// Fake-but-plausible year of contributions, so you can preview without a token.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function demoWeeks(today = new Date('2026-10-31T00:00:00Z')) {
  const rand = mulberry32(666);
  const end = new Date(today);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - end.getUTCDay() - 52 * 7);
  const weeks = [];
  let burst = 0;
  for (let w = 0; w < 53; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + w * 7 + d);
      if (date > end) break;
      if (burst === 0 && rand() < 0.035) burst = 10 + Math.floor(rand() * 12);
      const weekend = d === 0 || d === 6;
      let count = 0;
      if (burst > 0) { count = 2 + Math.floor(rand() * 14); burst--; }
      else if (rand() < (weekend ? 0.18 : 0.5)) count = 1 + Math.floor(rand() * rand() * 9);
      const level = count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4;
      days.push({ date: date.toISOString().slice(0, 10), count, level, weekday: d });
    }
    weeks.push(days);
  }
  return weeks;
}
