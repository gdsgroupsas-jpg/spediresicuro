import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const warnOnly = process.env.FILE_SIZE_STRICT !== 'true';
const threshold = Number(process.env.FILE_SIZE_LIMIT || 800);
const targets = [
  path.join(root, 'apps', 'web', 'actions'),
  path.join(root, 'apps', 'web', 'components'),
  path.join(root, 'apps', 'web', 'lib'),
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'dist'].includes(entry.name)) continue;
      walk(full, files);
    } else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const offenders = [];
for (const dir of targets) {
  for (const file of walk(dir)) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).length;
    if (lines > threshold) offenders.push({ file, lines });
  }
}

offenders.sort((a, b) => b.lines - a.lines);

if (offenders.length === 0) {
  console.log(`[file-size] OK - nessun file oltre ${threshold} linee`);
  process.exit(0);
}

const mode = warnOnly ? 'WARNING' : 'ERROR';
console.log(`[file-size] ${mode} - ${offenders.length} file oltre ${threshold} linee`);
for (const item of offenders.slice(0, 200)) {
  const rel = path.relative(root, item.file).replace(/\\/g, '/');
  console.log(`- ${rel}: ${item.lines} lines`);
}

if (!warnOnly) process.exit(1);
