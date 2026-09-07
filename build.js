'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const tscPath = path.resolve(root, '../../frontend/nexora-gms/node_modules/typescript/bin/tsc');

console.log('[build] Compiling CommonJS (tsc -p tsconfig.json)...');
execSync(`node "${tscPath}" -p tsconfig.json`, { cwd: root, stdio: 'inherit' });

console.log('[build] Compiling ESM (tsc -p tsconfig.esm.json)...');
execSync(`node "${tscPath}" -p tsconfig.esm.json`, { cwd: root, stdio: 'inherit' });

const esmDir = path.join(root, 'dist', 'esm');
fs.writeFileSync(path.join(esmDir, 'package.json'), JSON.stringify({ type: 'module' }, null, 2), 'utf8');

// Ensure all relative ESM imports include .js extensions for native Node.js ESM compliance
function fixEsmExtensions(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fixEsmExtensions(fullPath);
    } else if (entry.name.endsWith('.js') && entry.name !== 'package.json') {
      let content = fs.readFileSync(fullPath, 'utf8');
      content = content.replace(/(from\s+['"]|import\s+['"])(\.\.?\/[^'"]+)(['"])/g, (match, p1, p2, p3) => {
        if (p2.endsWith('.js') || p2.endsWith('.json')) return match;
        const currentFileDir = path.dirname(fullPath);
        const resolved = path.resolve(currentFileDir, p2);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
          return `${p1}${p2}/index.js${p3}`;
        }
        return `${p1}${p2}.js${p3}`;
      });
      // Also handle `export * from './types'`
      content = content.replace(/(export\s+\*\s+from\s+['"])(\.\.?\/[^'"]+)(['"])/g, (match, p1, p2, p3) => {
        if (p2.endsWith('.js') || p2.endsWith('.json')) return match;
        const currentFileDir = path.dirname(fullPath);
        const resolved = path.resolve(currentFileDir, p2);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
          return `${p1}${p2}/index.js${p3}`;
        }
        return `${p1}${p2}.js${p3}`;
      });
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
}

fixEsmExtensions(esmDir);
console.log('[build] Successfully generated dual CJS and ESM distributions in ./dist');
