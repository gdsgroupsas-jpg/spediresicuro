import { spawn, ChildProcess, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { extractFileFromError, generateFix } from '../lib/ai/doctor-core';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configuration
const DEBOUNCE_MS = 2000; // Wait 2s after last error line before analyzing
const REMOTE_POLL_MS = 10000; // Poll remote diagnostics every 10s
const IGNORED_ERRORS = [
  'ELIFECYCLE', // Generic npm error
  'warnings',   // Skip warnings for now
];

const EXTERNAL_ERROR_KEYWORDS = [
  'timeout', 
  '502 Bad Gateway', 
  'ECONNRESET', 
  'Spedisci.Online', 
  'Google API',
  'socket hang up',
  'ETIMEDOUT'
];

// Supabase Setup
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase: any = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

// State
let isFixing = false;
let errorBuffer = '';
let debounceTimer: NodeJS.Timeout | null = null;
let devProcess: ChildProcess | null = null;

// ==========================================
// ANTIGRAVITY PROTOCOL HELPERS (GIT & TRIAGE)
// ==========================================

function isExternalError(errorLog: string): boolean {
  return EXTERNAL_ERROR_KEYWORDS.some(keyword => errorLog.toLowerCase().includes(keyword.toLowerCase()));
}

function gitExec(command: string) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch (e: any) {
    if (e.message.includes('No such file') || e.message.includes('not a git repository')) {
      return null;
    }
    throw e;
  }
}

function checkBranchExists(branchName: string): boolean {
  try {
    gitExec(`git rev-parse --verify ${branchName}`);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Executes a function safely within an isolated git branch.
 * Returns true if successful, false otherwise.
 */
async function runIdeallyInIsolation(correlationId: string, errorType: string, operation: () => Promise<boolean>): Promise<boolean> {
  const timestamp = new Date().getTime();
  const safeId = (correlationId || 'unknown').slice(0, 8);
  const branchName = `fix/doctor-${safeId}-${timestamp}`;

  // 1. Loop Protection
  try {
    const existingBranches = gitExec('git branch --list "fix/doctor-*"');
    if (existingBranches && existingBranches.includes(`fix/doctor-${safeId}`)) {
      console.log(`🛡️ [ANTIGRAVITY] Fix branch for ${safeId} already exists. Aborting to avoid loops.`);
      return false;
    }
  } catch(e) {}

  console.log(`🌿 [ANTIGRAVITY] Isolating workspace...`);
  
  // Save current branch name
  let originalBranch = 'main';
  try {
    originalBranch = gitExec('git rev-parse --abbrev-ref HEAD') || 'main';
  } catch(e) { console.warn('⚠️ Could not determine current branch, assuming main'); }

  let stashed = false;
  try {
    // 2. Stash changes
    const status = gitExec('git status --porcelain');
    if (status) {
      console.log('📦 Stashing user changes...');
      gitExec('git stash push -m "Doctor: Pre-isolation stash"');
      stashed = true;
    }

    // 3. Create and Checkout new branch
    console.log(`🌿 Creating safe branch: ${branchName}`);
    gitExec(`git checkout -b ${branchName}`);

    // 4. Perform the operation (AI Fix)
    const success = await operation();

    if (!success) {
      console.log('⚠️ Operation failed or no fix needed. Rolling back...');
      gitExec(`git checkout ${originalBranch}`);
      if (stashed) gitExec('git stash pop');
      try { gitExec(`git branch -D ${branchName}`); } catch(e) {}
      return false;
    }

    // 5. Verification (Optional - e.g. type check)
    // console.log('🧪 Verifying fix...');
    // try { execSync('npm run type-check'); } catch(e) { ... }

    // 6. Secure Delivery
    console.log('📦 Committing fix...');
    gitExec('git add .');
    gitExec(`git commit -m "FIX(Doctor): Auto-healing for error ${safeId} (${errorType})"`);
    
    console.log('🚀 Pushing to origin...');
    try {
      gitExec(`git push origin ${branchName}`);
      console.log(`✅ [ANTIGRAVITY] Fix pushed to ${branchName}. Waiting for review.`);
      
      // Notify (Log for now)
      console.log(`📢 ACTION REQUIRED: Review and merge branch '${branchName}'`);
    } catch (e: any) {
      console.error(`❌ Push failed (maybe no remote?): ${e.message}`);
      // Don't rollback if push fails, user can check local branch
    }

  } catch (e: any) {
    console.error(`❌ [ANTIGRAVITY] Critical Failure:`, e);
    // Emergency Rollback
    try {
      gitExec(`git checkout ${originalBranch}`);
      if (stashed) gitExec('git stash pop');
    } catch (rollbackError) {
      console.error('💥 FATAL: Could not restore workspace state!', rollbackError);
    }
    return false;
  } finally {
    // 7. Restore User Environment
    try {
      const current = gitExec('git rev-parse --abbrev-ref HEAD');
      if (current === branchName) {
        console.log(`🔙 Returning to ${originalBranch}...`);
        gitExec(`git checkout ${originalBranch}`);
        if (stashed) {
            console.log('📦 Restoring user stash...');
            gitExec('git stash pop');
        }
      }
    } catch (e) { 
        // ignore errors during final restore assumption 
    }
  }

  return true;
}


/**
 * LOCAL WARD: Watch `npm run dev`
 */
function startLocalWard() {
  console.log('🏥 [DOCTOR] Starting Local Ward (Watch Mode)...');
  console.log('   Running "npm run dev"...');

  devProcess = spawn('npm', ['run', 'dev'], {
    shell: true,
    stdio: 'pipe',
    env: { ...process.env, FORCE_COLOR: 'true' }
  });

  if (!devProcess.stdout || !devProcess.stderr) {
    console.error('❌ [DOCTOR] Failed to stream process output');
    process.exit(1);
  }

  // Pipe output to console really cleanly
  devProcess.stdout.on('data', (data) => {
    process.stdout.write(data);
    handleOutput(data.toString());
  });

  devProcess.stderr.on('data', (data) => {
    process.stderr.write(data);
    handleOutput(data.toString());
  });

  devProcess.on('close', (code) => {
    console.log(`\n🛑 [DOCTOR] Dev server exited with code ${code}`);
    process.exit(code || 0);
  });
}

function handleOutput(chunk: string) {
  if (isFixing) return; // Don't analyze while already fixing

  // Check for error keywords
  if (chunk.includes('Error:') || chunk.includes('Failed to compile')) {
    errorBuffer += chunk;
    
    // Debounce detection logic
    if (debounceTimer) clearTimeout(debounceTimer);
    
    debounceTimer = setTimeout(() => {
      analyzeLocalExpection();
    }, DEBOUNCE_MS);
  }
}

async function analyzeLocalExpection() {
  if (isFixing || !errorBuffer) return;
  
  const currentError = errorBuffer;
  errorBuffer = ''; // Reset buffer immediately
  
  console.log('\n🔍 [DOCTOR] Detected error burst. Analyzing...');

  const culpritFile = extractFileFromError(currentError);
  
  if (!culpritFile) {
    console.log('   ⚠️ No file context found. Waiting for next error.');
    return;
  }

  // Check if file was recently modified (avoid race condition with user typing)
  try {
      const stats = fs.statSync(culpritFile);
      const msSinceModified = Date.now() - stats.mtimeMs;
      if (msSinceModified < 2000) {
        console.log('   ⚠️ File was just modified by user. Skipping fix to avoid conflict.');
        return;
      }
  } catch(e) {}

  isFixing = true;
  await attemptFix(currentError, culpritFile, false); // Local ward applies directly for now (dev speed)
  isFixing = false;
}

/**
 * REMOTE WARD: Poll Supabase
 */
async function startRemoteWard() {
  if (!supabase) {
    console.warn('⚠️ [DOCTOR] Remote Ward disabled: Supabase not configured.');
    return;
  }
  
  console.log('📡 [DOCTOR] Starting Remote Ward (Polling diagnostics_events)...');

  setInterval(async () => {
    if (isFixing) return;

    try {
      // Fetch unhandled critical/error events
      const { data, error } = await supabase
        .from('diagnostics_events')
        .select('*')
        .in('severity', ['critical', 'error'])
        .eq('handled', false) // You need to add this column to your table or track IDs locally
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) return;

      if (data && data.length > 0) {
        const event = data[0];
        console.log(`\n📡 [DOCTOR] Received REMOTE error: ${event.type} (${event.id})`);
        
        // 1. External Service Check (Triage)
        const contextStr = typeof event.context === 'string' 
            ? event.context 
            : JSON.stringify(event.context);

        if (isExternalError(contextStr)) {
            console.log('🛡️ [ANTIGRAVITY] Error deemed external (network/timeout). No code fix required.');
            // Mark as handled to ignore
            // await supabase.from('diagnostics_events').update({ handled: true }).eq('id', event.id);
            return;
        }

        const culpritFile = extractFileFromError(contextStr);

        if (culpritFile) {
          isFixing = true;
          console.log(`   Context points to ${path.basename(culpritFile)}`);
          
          // ANTIGRAVITY PROTOCOL for Remote Errors
          await runIdeallyInIsolation(event.correlation_id || event.id, event.type, async () => {
             return await attemptFix(contextStr, culpritFile, true); 
          });

          // Mark as handled
          // await supabase.from('diagnostics_events').update({ handled: true }).eq('id', event.id);
          
          isFixing = false;
        } else {
            console.log('   ⚠️ No file context in remote error. Skipping.');
        }
      }
    } catch (e) {
      // Ignore
    }
  }, REMOTE_POLL_MS);
}

/**
 * COMMON SURGERY LOGIC
 */
async function attemptFix(errorLog: string, filePath: string, isRemote: boolean): Promise<boolean> {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    if (!fileContent.trim()) return false;

    // AI Surgery
    const fixedContent = await generateFix(errorLog, filePath, fileContent);

    if (!fixedContent || fixedContent === fileContent) {
      console.log('   ⚠️ Could not generate a fix.');
      return false;
    }

    if (!isRemote) {
        // Local mode: Backup and Apply directly
        fs.writeFileSync(`${filePath}.bak`, fileContent);
        fs.writeFileSync(filePath, fixedContent);
        console.log(`✅ [DOCTOR] SURGERY SUCCESSFUL! Fixed ${path.basename(filePath)}`);
    } else {
        // Remote mode (Antigravity): Just apply to current branch (which is already isolated)
        fs.writeFileSync(filePath, fixedContent);
        console.log(`✅ [DOCTOR] Fixed applied to branch.`);
    }
    
    return true;
  } catch (e) {
    console.error('❌ [DOCTOR] Surgery failed:', e);
    return false;
  }
}

/**
 * MAIN ENTRY
 */
function main() {
  const mode = process.argv[2] || '--all';
  
  if (mode === '--all' || mode === '--local') {
    startLocalWard();
  }
  
  if (mode === '--all' || mode === '--remote') {
    startRemoteWard();
  }
}

main();
