const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'temp_env_local');
const dest = path.join(process.cwd(), '.env.local');

try {
  const data = fs.readFileSync(src, 'utf-8');
  fs.writeFileSync(dest, data, 'utf-8');
  console.log('✅ Copied successfully');
} catch (e) {
  console.error('❌ Copy failed:', e.message);
}
