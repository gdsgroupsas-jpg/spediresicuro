import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const warnOnly = process.env.BOUNDARY_STRICT !== 'true';

const domainPackages = new Set([
  'domain-auth',
  'domain-workspace',
  'domain-wallet',
  'domain-pricing',
  'domain-shipments',
  'domain-couriers',
  'domain-crm',
  'domain-notifications',
  'domain-ai',
]);

const allowedDomainDeps = {
  'domain-shipments': new Set(['domain-wallet', 'domain-pricing', 'domain-couriers', 'domain-workspace']),
  'domain-pricing': new Set(['domain-couriers', 'domain-workspace']),
  'domain-wallet': new Set(['domain-workspace']),
  'domain-ai': new Set(['domain-wallet', 'domain-pricing', 'domain-shipments', 'domain-crm']),
};

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'dist', '.git'].includes(entry.name)) continue;
      walk(full, files);
    } else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function parseImports(content) {
  const imports = [];
  const regex = /(?:import\s+[^'"\n]*from\s+|import\s*\(\s*|export\s+[^'"\n]*from\s+|require\s*\(\s*)['"]([^'"]+)['"]/g;
  let m;
  while ((m = regex.exec(content)) !== null) imports.push(m[1]);
  return imports;
}

function getLocalPackage(file) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (!rel.startsWith('packages/')) return null;
  const parts = rel.split('/');
  return parts.length > 1 ? parts[1] : null;
}

const files = [...walk(path.join(root, 'apps', 'web')), ...walk(path.join(root, 'packages'))];
const violations = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const imports = parseImports(content);
  const localPkg = getLocalPackage(file);

  for (const spec of imports) {
    if (!spec.startsWith('@ss/')) continue;

    const rest = spec.slice('@ss/'.length);
    const [targetPkg, ...subpath] = rest.split('/');
    if (!targetPkg) continue;

    if (subpath.length > 0) {
      violations.push({
        type: 'deep-import',
        file,
        detail: `Deep import non consentito: ${spec}`,
      });
      continue;
    }

    if (localPkg && domainPackages.has(localPkg) && domainPackages.has(targetPkg) && localPkg !== targetPkg) {
      const allowed = allowedDomainDeps[localPkg] ?? new Set();
      if (!allowed.has(targetPkg)) {
        violations.push({
          type: 'cross-domain',
          file,
          detail: `${localPkg} non puo dipendere da ${targetPkg}`,
        });
      }
    }

    if (localPkg && localPkg.startsWith('core-') && domainPackages.has(targetPkg)) {
      violations.push({
        type: 'core-to-domain',
        file,
        detail: `${localPkg} non puo dipendere da ${targetPkg}`,
      });
    }
  }
}

if (violations.length === 0) {
  console.log('[boundaries] OK - nessuna violazione rilevata');
  process.exit(0);
}

const mode = warnOnly ? 'WARNING' : 'ERROR';
console.log(`[boundaries] ${mode} - trovate ${violations.length} violazioni`);
for (const v of violations.slice(0, 200)) {
  const rel = path.relative(root, v.file).replace(/\\/g, '/');
  console.log(`- ${rel}: ${v.detail}`);
}

if (!warnOnly) process.exit(1);
