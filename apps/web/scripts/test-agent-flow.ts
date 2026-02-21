import { HumanMessage } from '@langchain/core/messages';
import * as dotenv from 'dotenv';
import path from 'path';
import { logisticsGraph } from '../lib/agent/orchestrator/graph';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import fs from 'fs';

async function runTest() {
  console.log('🚀 Starting Agent Flow Test (Live API)...');

  const mockTextInput = `
  Destinatario:
  Luigi Verdi
  Corso Buenos Aires 10
  20124 Milano (MI)
  `;

  // Read the image file provided by the user
  const imagePath = path.join(
    __dirname,
    '../C:/Users/sigor/.gemini/antigravity/brain/9677c0ee-4fc0-4e29-8dba-278056c7cc2c/uploaded_image_1765487815359.jpg'
  );
  // Wait, path.join with absolute path might be weird. Let's use absolute path directly.
  const absoluteImagePath =
    'C:/Users/sigor/.gemini/antigravity/brain/9677c0ee-4fc0-4e29-8dba-278056c7cc2c/uploaded_image_1765487815359.jpg';

  let base64Image = '';
  try {
    if (fs.existsSync(absoluteImagePath)) {
      console.log(`📸 Reading test image: ${absoluteImagePath}`);
      base64Image = fs.readFileSync(absoluteImagePath, 'base64');
    } else {
      console.warn(`⚠️ Test image not found at ${absoluteImagePath}. Using text fallback.`);
    }
  } catch (e) {
    console.warn('⚠️ Error reading image:', e);
  }

  const initialState = {
    messages: [
      new HumanMessage({
        content: base64Image
          ? `data:image/jpeg;base64,${base64Image}`
          : `Testo OCR:\n${mockTextInput}`,
      }),
    ],
    shipmentData: {},
    processingStatus: 'idle',
    validationErrors: [],
    confidenceScore: 0,
    needsHumanReview: false,
    userEmail: 'testspediresicuro+postaexpress@gmail.com',
    userId: '904dc243-e9da-408d-8c0b-5dbe2a48b739', // Test reseller account
  };

  try {
    const finalState = await logisticsGraph.invoke(initialState);

    console.log('✅ Agent Flow Complete!');
    console.log('--------------------------------');
    console.log('Status:', finalState.processingStatus);
    console.log('Shipment ID:', finalState.shipmentId);
    console.log('Data:', JSON.stringify(finalState.shipmentData, null, 2));
    console.log('Selected Courier:', (finalState.selectedCourier as any)?.name);
    console.log('Confidence:', finalState.confidenceScore);
    console.log('Needs Review:', finalState.needsHumanReview);
  } catch (error) {
    console.error('❌ Test Failed:', error);
  }
}

runTest();
