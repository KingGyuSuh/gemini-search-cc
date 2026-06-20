import fs from 'node:fs';

// Read stdin from Claude Code hook system. This is an ADVISORY guard, so any
// problem reading/parsing the payload must fail OPEN (emit `{}`, exit 0) — a bad
// payload must never block a Bash call or spew a stack trace into the session.
let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf-8') || '{}');
} catch {
  process.stdout.write(JSON.stringify({}));
  process.exit(0);
}
const command = String(input?.tool_input?.command ?? '').trim();
const commandLower = command.toLowerCase();

// Only intercept package install/add commands where audit is genuinely useful.
// Excludes infrastructure tools (docker, terraform, kubectl), scaffolding (npx, create),
// and niche ecosystems to avoid alert fatigue.
const ecosystems = [
  { name: 'JavaScript/TypeScript', managers: ['npm', 'yarn', 'pnpm', 'bun'], keywords: ['install', 'add', 'update', 'upgrade'] },
  { name: 'Python', managers: ['pip', 'pip3', 'poetry', 'uv', 'conda', 'pipenv', 'pdm'], keywords: ['install', 'add', 'update', 'upgrade'] },
  { name: 'Rust', managers: ['cargo'], keywords: ['add', 'install'] },
  { name: 'Go', managers: ['go'], keywords: ['get', 'install'] },
  { name: 'PHP', managers: ['composer'], keywords: ['require', 'install', 'update'] },
  { name: 'Ruby', managers: ['gem', 'bundle', 'bundler'], keywords: ['install', 'add', 'update'] },
  { name: 'System', managers: ['brew', 'apt', 'apt-get'], keywords: ['install'] },
];

let detected = null;

for (const eco of ecosystems) {
  const matchesManager = eco.managers.some(
    (m) => commandLower.startsWith(m + ' ') || commandLower === m,
  );
  if (!matchesManager) continue;

  // Match the keyword as a whole TOKEN, not a substring, so e.g.
  // `pip download mypackage-installer` does not false-trigger on "install".
  const tokens = commandLower.split(/\s+/);
  const matchesKeyword = eco.keywords.some((k) => tokens.includes(k));
  if (!matchesKeyword) continue;

  detected = eco.name;
  break;
}

if (detected) {
  // Extract the likely package name(s) for a more targeted suggestion. Only look
  // at the first command segment so chained commands (`&& rm -rf …`) don't leak in.
  const firstSegment = command.split(/&&|\|\||;|\|/)[0];
  const parts = firstSegment.trim().split(/\s+/);
  const filtered = parts.filter(
    (p) => !p.startsWith('-') && !p.startsWith('/') && p.length > 1,
  );
  const packages = filtered.slice(2).join(', ') || '(packages in command)';

  console.log(
    JSON.stringify({
      type: 'prompt',
      prompt:
        `[Gemini ${detected} Guard] About to run: \`${command}\`\n` +
        `Consider running \`/gemini:audit ${packages}\` to check for known vulnerabilities, ` +
        `deprecated patterns, or breaking changes before proceeding.`,
    }),
  );
} else {
  // No match — allow the command to proceed without prompt
  console.log(JSON.stringify({}));
}
