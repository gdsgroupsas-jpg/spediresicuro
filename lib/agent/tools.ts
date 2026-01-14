
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getShipmentsByPeriod, getPendingCOD, type UserRole } from "./fiscal-data";

// Tool per analizzare margini in un periodo specifico
// Nota: In questa architettura RAG "Context-First", l'AI riceve già i dati recenti.
// Questo tool serve se l'utente chiede date DIVERSE dai default (es. "Dammi il fatturato dell'anno scorso").

export const createFiscalTools = (userId: string, role: UserRole) => {
  return [
    new DynamicStructuredTool({
      name: "analyze_custom_period",
      description: "Recupera dati finanziari e margini per un periodo specifico indicato dall'utente.",
      schema: z.object({
        startDate: z.string().describe("Data inizio ISO (YYYY-MM-DD)"),
        endDate: z.string().describe("Data fine ISO (YYYY-MM-DD)"),
      }),
      func: async ({ startDate, endDate }) => {
        try {
          const data = await getShipmentsByPeriod(userId, role, startDate, endDate);
          const totalMargin = data?.reduce((acc, s) => acc + (s.margin || 0), 0);
          const totalRevenue = data?.reduce((acc, s) => acc + (s.total_price || 0), 0);
          
          return JSON.stringify({
            period: { startDate, endDate },
            count: data?.length,
            total_margin: totalMargin,
            total_revenue: totalRevenue,
            details_sample: data?.slice(0, 5) // Sample per contesto
          });
        } catch (error: any) {
          return `Errore recupero dati: ${error.message}`;
        }
      },
    }),

    new DynamicStructuredTool({
        name: "check_cod_details",
        description: "Controlla i dettagli dei contrassegni in sospeso.",
        schema: z.object({}),
        func: async () => {
             const cods = await getPendingCOD(userId, role);
             return JSON.stringify(cods);
        }
    })
  ];
};
