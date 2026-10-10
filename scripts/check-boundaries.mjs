#!/usr/bin/env node
// Enforces the module boundaries described in AGENTS.md. No dependencies.
// Run: npm run check:boundaries
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Which @jimmyit/* specifiers each package may import, and which third-party
// packages. Tests may also import `vitest`.
const RULES = {
  'packages/protocol': { internal: [], thirdParty: [] },
  'packages/core': { internal: ['@jimmyit/protocol'], thirdParty: [] },
  'packages/ai': { internal: [], thirdParty: [] },
  'packages/fake-fidget': { internal: ['@jimmyit/protocol', '@jimmyit/core'], thirdParty: [] },
  'packages/ble-react-native': {
    internal: ['@jimmyit/protocol', '@jimmyit/core'],
    testInternal: ['@jimmyit/fake-fidget'],
    thirdParty: [],
  },
  'packages/app-kit': {
    internal: ['@jimmyit/core', '@jimmyit/game-sdk'],
    testInternal: ['@jimmyit/fake-fidget'],
    thirdParty: ['react'],
  },
  'packages/dev-toy': {
    internal: ['@jimmyit/app-kit', '@jimmyit/core', '@jimmyit/fake-fidget'],
    thirdParty: ['react', 'react-native'],
  },
  'packages/game-sdk': {
    internal: ['@jimmyit/core', '@jimmyit/fake-fidget'],
    thirdParty: [],
    // The fake fidget is for the test harness only, never for shipped code.
    onlyFrom: { '@jimmyit/fake-fidget': ['src/testing.ts'] },
  },
  'games/*': {
    internal: ['@jimmyit/game-sdk'],
    testInternal: ['@jimmyit/game-sdk/testing'],
    thirdParty: ['react', 'react-native'],
  },
};

// Packages that must run unchanged in React Native, Node and tests.
const PLATFORM_FREE = ['packages/protocol', 'packages/core', 'packages/ai', 'packages/fake-fidget', 'packages/game-sdk', 'packages/app-kit'];
const FORBIDDEN_GLOBALS = [
  [/\bBuffer\b/, 'Buffer (Node only; use Uint8Array)'],
  [/\bprocess\./, 'process (Node only)'],
  [/\brequire\(/, 'require() (use import)'],
  [/\bwindow\./, 'window (browser only)'],
  [/\bdocument\./, 'document (browser only)'],
];

const IMPORT_RE = /(?:^|[\s;])(?:import|export)\s(?:[^'"]*?\sfrom\s*)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...listFiles(path));
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

function packageDirs() {
  const dirs = [];
  for (const group of ['packages', 'games', 'apps']) {
    const groupDir = join(ROOT, group);
    let names = [];
    try {
      names = readdirSync(groupDir);
    } catch {
      continue;
    }
    for (const name of names) {
      try {
        statSync(join(groupDir, name, 'package.json'));
        dirs.push(`${group}/${name}`);
      } catch {
        // not a package yet
      }
    }
  }
  return dirs;
}

function rulesFor(pkg) {
  if (RULES[pkg]) return RULES[pkg];
  const wildcard = `${pkg.split('/')[0]}/*`;
  return RULES[wildcard] ?? null;
}

const problems = [];
const report = (file, message) => problems.push(`${relative(ROOT, file)}: ${message}`);

for (const pkg of packageDirs()) {
  const rules = rulesFor(pkg);
  if (!rules) {
    if (!pkg.startsWith('apps/')) problems.push(`${pkg}: no boundary rules; add it to scripts/check-boundaries.mjs`);
    continue; // apps may import anything
  }
  const pkgDir = join(ROOT, pkg);
  const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  const declared = new Set(Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies }));
  const declaredForTests = new Set([...declared, ...Object.keys(manifest.devDependencies ?? {})]);
  let srcFiles = [];
  try {
    srcFiles = listFiles(join(pkgDir, 'src'));
  } catch {
    continue;
  }

  for (const file of srcFiles) {
    const rel = relative(pkgDir, file).split(sep).join('/');
    const isTest = /\.test\.tsx?$/.test(file);
    const text = readFileSync(file, 'utf8');
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

    for (const match of code.matchAll(IMPORT_RE)) {
      const spec = match[1] ?? match[2];
      if (spec.startsWith('.')) {
        const target = resolve(dirname(file), spec);
        if (!target.startsWith(pkgDir + sep)) report(file, `relative import "${spec}" leaves ${pkg}; import the package instead`);
        continue;
      }
      if (spec.startsWith('@jimmyit/')) {
        const allowed = [...rules.internal, ...(isTest ? rules.testInternal ?? [] : [])];
        if (!allowed.includes(spec)) {
          report(file, `may not import "${spec}" (allowed: ${allowed.join(', ') || 'no @jimmyit packages'})`);
          continue;
        }
        const only = rules.onlyFrom?.[spec];
        if (only && !only.includes(rel)) report(file, `"${spec}" may only be imported from ${only.join(', ')}`);
        const base = spec.split('/').slice(0, 2).join('/');
        if (!(isTest ? declaredForTests : declared).has(base)) report(file, `imports "${base}" but ${pkg}/package.json does not list it in dependencies`);
        continue;
      }
      if (spec.startsWith('node:')) {
        report(file, `Node built-in "${spec}" is not available in React Native`);
        continue;
      }
      const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (isTest && name === 'vitest') continue;
      if (!rules.thirdParty.includes(name)) report(file, `third-party import "${spec}" is not allowed here`);
    }

    if (PLATFORM_FREE.includes(pkg) && !isTest) {
      for (const [pattern, why] of FORBIDDEN_GLOBALS) {
        if (pattern.test(code)) report(file, `uses ${why}`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`Module boundary check failed (${problems.length}):\n  ${problems.join('\n  ')}`);
  console.error('\nSee AGENTS.md "Module boundaries".');
  process.exit(1);
}
console.log('Module boundaries OK');
