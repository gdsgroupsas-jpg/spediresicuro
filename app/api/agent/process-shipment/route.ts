import { NextRequest, NextResponse } from 'next/server';
import { logisticsGraph } from '@/lib/agent/orchestrator/graph';
import { HumanMessage } from '@langchain/core/messages';
import { auth } from '@/lib/auth-config';

export const maxDuration = 60; // Allow longer timeout for agent execution (OCR + LLM)

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { image, text, options } = await request.json();

    if (!image && !text) {
      return NextResponse.json(
        { success: false, error: 'Input mancante (immagine o testo richiesto)' },
        { status: 400 }
      );
    }

    // 1. Initialize State
    const initialState = {
      messages: [
        new HumanMessage({
          content: image ? `data:image/jpeg;base64,${image}` : text,
        }),
      ],
      shipmentData: {},
      processingStatus: 'idle',
      validationErrors: [],
      confidenceScore: 0,
      needsHumanReview: false,
      userEmail: session.user.email,
      userId: session.user.id || '', // Fallback if ID is missing in session type
    };

    // 2. Run Graph
    // Use .invoke() to run until END
    const finalState = await logisticsGraph.invoke(initialState);

    // 3. Return Result
    return NextResponse.json({
      success: true,
      shipmentId: finalState.shipmentId, // Only present if saved
      status: finalState.processingStatus,
      data: finalState.shipmentData,
      validationErrors: finalState.validationErrors,
      needsReview: finalState.needsHumanReview,
      confidence: finalState.confidenceScore,
      // Debug info
      selectedCourier: finalState.selectedCourier,
    });

  } catch (error: any) {
    console.error('Agent Execution Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore interno dell\'agente',
      },
      { status: 500 }
    );
  }
}
