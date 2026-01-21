#!/usr/bin/env node
/**
 * Syntax Validator
 * Validates JavaScript syntax using Node.js --check flag
 * Used by pre-commit hook to prevent broken code from being committed
 */

const { execSync } = require('child_process');
const process = require('process');

// Get staged files from git
const stagedFiles = process.argv.slice(2);

if (stagedFiles.length === 0) {
  console.log('✅ No files to validate');
  process.exit(0);
}

let hasErrors = false;

for (const file of stagedFiles) {
  // Only check .js files (TypeScript is checked by tsc)
  if (!file.endsWith('.js')) {
    continue;
  }

  // Skip k6 test files (they use ES modules)
  if (file.includes('.k6.js')) {
    continue;
  }

  try {
    execSync(`node --check "${file}"`, { stdio: 'pipe' });
  } catch (error) {
    console.error(`❌ Syntax error in ${file}:`);
    console.error(error.stderr.toString());
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('\n❌ Syntax validation failed. Fix errors before committing.');
  process.exit(1);
}

console.log('✅ Syntax validation passed');
process.exit(0);
