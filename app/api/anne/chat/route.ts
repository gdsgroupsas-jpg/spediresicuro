
import { NextRequest, NextResponse } from 'next/server';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { createServerActionClient } from '@/lib/supabase-server';
import { getFiscalContext } from '@/lib/agent/fiscal-data';
import { ANNE_FISCAL_SYSTEM_PROMPT } from './prompts';
import { createFiscalTools } from '@/lib/agent/tools';
import { consultFiscalBrain } from '@/lib/knowledge/fiscal_brain'; // NEW

export async function POST(request: NextRequest) {
  try {
    // 1. Auth & Context
    const supabase = createServerActionClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Lettura Ruolo da public.users
    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
    
    const role = userData?.role || 'user';
    const body = await request.json();
    const { message, context: clientContext } = body;

    if (!process.env.GOOGLE_API_KEY) {
        return NextResponse.json({ error: 'Configurazione AI mancante (API Key)' }, { status: 500 });
    }

    // 2. Data Fetching (RAG Sicuro)
    const fiscalData = await getFiscalContext(user.id, role);
    
    // 2b. Brain Consultation (Retrieval Knowledge)
    const brainContext = consultFiscalBrain(message);

    // 3. Prompt Construction
    let systemPrompt = ANNE_FISCAL_SYSTEM_PROMPT
        .replace('{{USER_ID}}', user.id)
        .replace('{{ROLE}}', role.toUpperCase())
        .replace('{{FISCAL_CONTEXT}}', JSON.stringify(fiscalData, null, 2))
        .replace('{{FISCAL_BRAIN_CONTEXT}}', brainContext || "Nessuna regola specifica applicata.");

    // 4. Initialize Gemini
    const llm = new ChatGoogleGenerativeAI({
        model: 'gemini-2.0-flash-exp', // Fast & Free Tier eligible (Preview)
        maxOutputTokens: 2048,
        temperature: 0.2, // Bassa per precisione dati
        apiKey: process.env.GOOGLE_API_KEY
    });

    // Bind Tools
    const tools = createFiscalTools(user.id, role);
    const llmWithTools = llm.bindTools(tools);

    // 5. Chat Execution
    const messages = [
        new SystemMessage(systemPrompt),
        ...(clientContext?.previousMessages?.map((m: any) => 
            m.role === 'user' ? new HumanMessage(m.content) : 
            m.role === 'assistant' ? new SystemMessage(m.content) : // Semplificazione history
            new HumanMessage(m.content)
        ) || []),
        new HumanMessage(message)
    ];

    const response = await llmWithTools.invoke(messages);

    // Gestione Tool Calls (Semplificata: single turn)
    // Se Gemini vuole chiamare un tool, lo eseguiamo e ritorniamo il risultato.
    // In un'implementazione full, questo sarebbe un loop (AgentExecutor).
    // Qui facciamo un semplice "1-hop" per velocità.
    
    if (response.tool_calls && response.tool_calls.length > 0) {
        // Esegui tools
        const toolMessages = [];
        for (const call of response.tool_calls) {
            const tool = tools.find(t => t.name === call.name);
            if (tool) {
                console.log(`🛠️ Executing Tool: ${tool.name}`);
                const output = await tool.invoke(call.args);
                toolMessages.push(new ToolMessage({
                    tool_call_id: call.id || '',
                    content: output,
                    name: call.name
                }));
            }
        }
        
        // Richiamata finale all'LLM con gli output dei tool
        const finalResponse = await llmWithTools.invoke([
            ...messages,
            response,
            ...toolMessages
        ]);
        
        return NextResponse.json({
            message: finalResponse.content,
            timestamp: new Date().toISOString()
        });
    }

    // Risposta diretta senza tools
    return NextResponse.json({
        message: response.content,
        timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Errore Anne Agent:', error);
    return NextResponse.json(
        { error: 'Errore durante elaborazione richiesta.' }, 
        { status: 500 }
    );
  }
}
