import { StateGraph, END } from '@langchain/langgraph';
import { AgentState } from './state';
import { 
  extractData, 
  validateGeo, 
  selectCourier, 
  calculateMargins, 
  saveShipment, 
  humanReview 
} from './nodes';

// Global recursion limit to prevent infinite loops (as requested)
const RECURSION_LIMIT = 5;

// Define the Conditional Logic
const checkConfidence = (state: AgentState) => {
    // If flagged for review or has errors, go to human_review
    if (state.needsHumanReview || state.validationErrors.length > 0) {
        return 'human_review';
    }

    // If confidence is too low, go to review
    if (state.confidenceScore < 80) {
        return 'human_review';
    }

    // Otherwise proceed to save
    return 'save_shipment';
};

const checkGeoValidation = (state: AgentState) => {
    if (state.validationErrors.length > 0 || state.needsHumanReview) {
        return 'human_review';
    }
    return 'select_courier';
};

// Create the Graph
const workflow = new StateGraph<AgentState>({
    channels: {
      messages: {
        reducer: (a, b) => a.concat(b),
        default: () => [],
      },
      shipmentData: {
        reducer: (a, b) => ({ ...a, ...b }),
        default: () => ({}),
      },
      // Overwrite reducers for these fields
      shipmentId: { reducer: (a, b) => b ?? a },
      processingStatus: { reducer: (a, b) => b ?? a },
      validationErrors: { reducer: (a, b) => b ?? a }, // Replace errors list entirely on updates usually
      confidenceScore: { reducer: (a, b) => b ?? a },
      needsHumanReview: { reducer: (a, b) => b ?? a },
      selectedCourier: { reducer: (a, b) => b ?? a },
      userId: { reducer: (a, b) => b ?? a },
      userEmail: { reducer: (a, b) => b ?? a },
    }
});

// Add Nodes
workflow.addNode('extract_data', extractData);
workflow.addNode('validate_geo', validateGeo);
workflow.addNode('select_courier', selectCourier);
workflow.addNode('calculate_margins', calculateMargins);
workflow.addNode('save_shipment', saveShipment);
workflow.addNode('human_review', humanReview);

// Add Edges
workflow.setEntryPoint('extract_data' as any);

workflow.addEdge('extract_data' as any, 'validate_geo' as any);

// Conditional Edge after Geo Validation
workflow.addConditionalEdges(
    'validate_geo' as any,
    checkGeoValidation,
    {
        human_review: 'human_review',
        select_courier: 'select_courier'
    } as any
);

workflow.addEdge('select_courier' as any, 'calculate_margins' as any);

// Conditional Edge after Calculation (Final Check)
workflow.addConditionalEdges(
    'calculate_margins' as any,
    checkConfidence,
    {
        human_review: 'human_review',
        save_shipment: 'save_shipment'
    } as any
);

workflow.addEdge('save_shipment' as any, END);
workflow.addEdge('human_review' as any, END);

// Compile the graph
export const logisticsGraph = workflow.compile();
