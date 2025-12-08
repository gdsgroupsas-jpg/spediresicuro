import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';

// Load environment variables if not already loaded
if (!process.env.ANTHROPIC_API_KEY) {
  dotenv.config({ path: '.env.local' });
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// Default to Haiku for speed/cost, can be overridden
const DEFAULT_MODEL = 'claude-3-haiku-20240307'; 

let anthropicClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (anthropicClient) return anthropicClient;
  
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not found in environment variables');
  }

  anthropicClient = new Anthropic({
    apiKey: ANTHROPIC_API_KEY,
  });
  
  return anthropicClient;
}

/**
 * Extracts a probable file path from an error string.
 * Supports absolute and relative paths, with or without line numbers.
 */
export function extractFileFromError(output: string): string | null {
  // Regex:
  // - Absolute: /path/to/file.ts or C:\path\to\file.ts
  // - Relative: scripts/file.ts or ./file.ts
  // - With line numbers: file.ts:10:5
  const pathRegex = /(?:[a-zA-Z]:[\\/])?(?:[\w\-\.]+[\\/])*[\w\-\.]+\.(?:tsx|jsx|ts|js)(?::\d+(?::\d+)?)?/g;
  const matches = output.match(pathRegex);

  if (!matches) return null;

  // Filter for files that actually exist in the project
  const cwd = process.cwd();
  for (const match of matches) {
    // Determine if it has line numbers (ending with :digit or :digit:digit)
    // We can't just split by ':' because of Windows drive letters (C:\)
    
    let cleanPath = match;
    // Remove :line:col or :line at the end
    cleanPath = cleanPath.replace(/:\d+(?::\d+)?$/, '');
    
    const filePath = cleanPath;
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
    
    // Ignore node_modules
    if (absolutePath.includes('node_modules')) continue;

    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  return null;
}

/**
 * Generates a fix for a given error and file content using Claude.
 */
export async function generateFix(errorOutput: string, filePath: string, fileContent: string): Promise<string | null> {
  const client = getAnthropicClient();
  const filename = path.basename(filePath);

  console.log(`\n🤖 [DOCTOR] Consulting Claude (${DEFAULT_MODEL}) for ${filename}...`);

  try {
    const message = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are an expert TypeScript/Next.js developer. 
          I have a file that is causing an error.
          
          ERROR OUTPUT:
          ${errorOutput}
          
          FILE CONTENT (${filePath}):
          \`\`\`typescript
          ${fileContent}
          \`\`\`
          
          TASK: Fix the code to resolve the error. 
          
          STRICT CONSTRAINTS (ANTIGRAVITY PROTOCOL):
          1. Do NOT modify complex business logic.
          2. Limit changes to syntax fixes, null checks, type errors, and imports.
          3. If the logic seems fundamentally broken, do NOT try to rewrite it. Return the original code.
          4. Return ONLY the full corrected content of the file. 
          5. Do not include markdown code block markers (like \`\`\`typescript). 
          6. Do not include explanations. 
          7. Just the raw code.`
        }
      ]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    // Clean up any markdown block if the model disobeyed
    const cleanCode = responseText
      .replace(/^```[a-z]*\n/, '')
      .replace(/\n```$/, '')
      .trim();

    return cleanCode;

  } catch (error) {
    console.error('❌ [DOCTOR] AI Request Failed:', error);
    return null;
  }
}
