'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const tsc = require.resolve('typescript/bin/tsc');

function run(config, label) {
  console.log(`[build] Compiling ${label}...`);

  execFileSync(
    process.execPath,
    [tsc, '-p', config],
    {
      stdio: 'inherit',
      cwd: __dirname
    }
  );
}

// Build CommonJS
run('tsconfig.json', 'CommonJS');

// Build ESM
run('tsconfig.esm.json', 'ESM');

// Mark only the ESM output directory as ES modules
const esmDir = path.join(__dirname, 'dist', 'esm');
const esmPackageJsonPath = path.join(esmDir, 'package.json');

fs.mkdirSync(esmDir, { recursive: true });

fs.writeFileSync(
  esmPackageJsonPath,
  JSON.stringify(
    {
      type: 'module'
    },
    null,
    2
  ) + '\n',
  'utf8'
);

console.log('[build] Created dist/esm/package.json with type=module');
console.log('[build] Nexora SDK build completed successfully.');