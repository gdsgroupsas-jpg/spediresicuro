// Quick test script to create API key directly
const { generateApiKey } = require('./lib/api-key-service.ts');

// Use test user ID (you're logged in as this user)
const TEST_USER_ID = 'admin@spediresicuro.it'; // Replace with actual user ID from session

async function createTestKey() {
  try {
    console.log('Creating test API key...');

    const result = await generateApiKey(TEST_USER_ID, 'E2E Test Key', {
      scopes: ['quotes:read', 'shipments:read'],
      expiresInDays: 90
    });

    console.log('\n✅ API Key Created Successfully!\n');
    console.log('Key:', result.key);
    console.log('Prefix:', result.keyPrefix);
    console.log('ID:', result.id);
    console.log('\n⚠️ SAVE THIS KEY - It will never be shown again!\n');

    return result;
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

createTestKey().then(() => process.exit(0)).catch(() => process.exit(1));
