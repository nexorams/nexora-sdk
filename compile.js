'use strict';

const path = require('node:path');
const fs = require('node:fs');
const ts = require('typescript');

function compile(configPath, label) {
  console.log(`[compile] Compiling ${label} using in-process TypeScript API...`);
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    console.error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
    return false;
  }

  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, __dirname);
  if (parsed.errors && parsed.errors.length > 0) {
    for (const err of parsed.errors) {
      console.error(ts.flattenDiagnosticMessageText(err.messageText, '\n'));
    }
    return false;
  }

  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const emitResult = program.emit();
  const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

  let hasErrors = false;
  for (const diag of allDiagnostics) {
    if (diag.category === ts.DiagnosticCategory.Error) {
      hasErrors = true;
    }
    if (diag.file) {
      const { line, character } = ts.getLineAndCharacterOfPosition(diag.file, diag.start);
      const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
      console.log(`[${label}] ${diag.file.fileName} (${line + 1},${character + 1}): ${message}`);
    } else {
      console.log(`[${label}] ${ts.flattenDiagnosticMessageText(diag.messageText, '\n')}`);
    }
  }

  if (hasErrors || emitResult.emitSkipped) {
    console.error(`[compile] ${label} compilation failed.`);
    return false;
  }

  console.log(`[compile] ${label} compilation succeeded.`);
  return true;
}

const cjsSuccess = compile(path.join(__dirname, 'tsconfig.json'), 'CommonJS');
const esmSuccess = compile(path.join(__dirname, 'tsconfig.esm.json'), 'ESM');

if (!cjsSuccess || !esmSuccess) {
  process.exit(1);
}

const esmDir = path.join(__dirname, 'dist', 'esm');
fs.mkdirSync(esmDir, { recursive: true });
fs.writeFileSync(
  path.join(esmDir, 'package.json'),
  JSON.stringify({ type: 'module' }, null, 2) + '\n',
  'utf8'
);

console.log('[compile] ALL BUILDS COMPLETED SUCCESSFULLY!');
