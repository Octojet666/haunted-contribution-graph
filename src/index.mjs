#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { render } from './render.mjs';
import { demoWeeks } from './demo.mjs';

const { values: a } = parseArgs({
  options: {
    user: { type: 'string' },
    token: { type: 'string' },
    out: { type: 'string', default: 'dist' },
    name: { type: 'string', default: 'haunted' },
    themes: { type: 'string', default: 'dark,light' },
    duration: { type: 'string', default: '28' },
    demo: { type: 'boolean', default: false },
    at: { type: 'string' },
    frames: { type: 'string' },
  },
});

const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

async function fetchWeeks(login, token) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'haunted-contribution-graph' },
    body: JSON.stringify({
      query: `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount contributionLevel weekday}}}}}}`,
      variables: { login },
    }),
  });
  if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join('; '));
  if (!json.data?.user) throw new Error(`No GitHub user named "${login}"`);
  return json.data.user.contributionsCollection.contributionCalendar.weeks.map((w) =>
    w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount, level: LEVELS[d.contributionLevel] ?? 0, weekday: d.weekday })),
  );
}

const user = a.user ?? (a.demo ? 'octojet666' : undefined);
if (!user) {
  console.error('Usage: haunt --user <login> [--token <pat>] [--out dist] [--themes dark,light] [--duration 28]\n       haunt --demo   (preview with fake data, no token needed)');
  process.exit(1);
}
const token = a.token ?? process.env.GITHUB_TOKEN;
if (!a.demo && !token) {
  console.error('A token is required (pass --token or set GITHUB_TOKEN). Use --demo to preview without one.');
  process.exit(1);
}

const weeks = a.demo ? demoWeeks() : await fetchWeeks(user, token);
await mkdir(a.out, { recursive: true });
const duration = Math.max(8, Number(a.duration) || 28);

for (const theme of a.themes.split(',').map((s) => s.trim()).filter(Boolean)) {
  if (a.frames) {
    const count = Number(a.frames);
    for (let i = 0; i < count; i++) {
      const at = i / count;
      await writeFile(`${a.out}/frame-${String(i).padStart(3, '0')}.svg`, render({ weeks, username: user, theme, duration, at }));
    }
    console.log(`wrote ${count} frames to ${a.out}/`);
    continue;
  }
  const at = a.at === undefined ? undefined : Number(a.at);
  const file = `${a.out}/${a.name}-${theme}${at === undefined ? '' : '-still'}.svg`;
  await writeFile(file, render({ weeks, username: user, theme, duration, at }));
  console.log(`wrote ${file}`);
}
