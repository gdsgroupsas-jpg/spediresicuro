/**
 * Agent Debug Panel
 * 
 * Componente UI per mostrare routing decisions del supervisor e telemetria.
 * Visibile solo per admin/superadmin.
 * 
 * Mostra:
 * - intent_detected, supervisor_decision, backend_used, fallback_reason
 * - iteration_count, processingStatus, confidenceScore
 * - mentor_response con sources e confidence (se presente)
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bug,
  X,
  ChevronDown,
  ChevronUp,
  Activity,
  Zap,
  AlertCircle,
  CheckCircle,
  Info,
} from 'lucide-react';
import type { SupervisorRouterTelemetry } from '@/lib/telemetry/logger';
import type { AgentState } from '@/lib/agent/orchestrator/state';

interface AgentDebugPanelProps {
  telemetry?: SupervisorRouterTelemetry;
  agentState?: Partial<AgentState>;
}

export function AgentDebugPanel({ telemetry, agentState }: AgentDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(() => {
    // Carica preferenza da localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('agent-debug-panel-visible');
      return saved === 'true';
    }
    return false;
  });

  // Salva preferenza in localStorage
  const toggleVisibility = () => {
    const newVisible = !isVisible;
    setIsVisible(newVisible);
    if (typeof window !== 'undefined') {
      localStorage.setItem('agent-debug-panel-visible', String(newVisible));
    }
  };

  if (!isVisible) {
    return (
      <button
        onClick={toggleVisibility}
        className="fixed bottom-4 left-4 z-50 p-2 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-all"
        title="Mostra Debug Panel"
      >
        <Bug className="w-5 h-5" />
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-4 left-4 z-50 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-2xl border border-purple-200 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5 text-white" />
          <h3 className="text-white font-semibold text-sm">Agent Debug Panel</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-white" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white" />
            )}
          </button>
          <button
            onClick={toggleVisibility}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
              {/* Telemetria Supervisor */}
              {telemetry && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Supervisor Telemetry
                  </h4>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-gray-600">Intent:</span>
                      <span className="font-mono text-xs font-semibold text-purple-600">
                        {telemetry.intentDetected}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-gray-600">Decision:</span>
                      <span className="font-mono text-xs font-semibold text-blue-600">
                        {telemetry.supervisorDecision}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-gray-600">Backend:</span>
                      <span className="font-mono text-xs font-semibold text-green-600">
                        {telemetry.backendUsed}
                      </span>
                    </div>
                    
                    {telemetry.fallbackToLegacy && (
                      <div className="flex items-center justify-between p-2 bg-yellow-50 rounded border border-yellow-200">
                        <span className="text-gray-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-yellow-600" />
                          Fallback:
                        </span>
                        <span className="font-mono text-xs font-semibold text-yellow-700">
                          {telemetry.fallbackReason || 'unknown'}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-gray-600">Duration:</span>
                      <span className="font-mono text-xs font-semibold">
                        {telemetry.duration_ms}ms
                      </span>
                    </div>
                    
                    {telemetry.pricingOptionsCount !== undefined && (
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-gray-600">Pricing Options:</span>
                        <span className="font-mono text-xs font-semibold">
                          {telemetry.pricingOptionsCount}
                        </span>
                      </div>
                    )}
                    
                    {telemetry.workerRun && (
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-gray-600">Worker Run:</span>
                        <span className="font-mono text-xs font-semibold text-indigo-600">
                          {telemetry.workerRun}
                        </span>
                      </div>
                    )}
                    
                    {telemetry.missingFieldsCount !== undefined && telemetry.missingFieldsCount > 0 && (
                      <div className="flex items-center justify-between p-2 bg-orange-50 rounded border border-orange-200">
                        <span className="text-gray-600">Missing Fields:</span>
                        <span className="font-mono text-xs font-semibold text-orange-700">
                          {telemetry.missingFieldsCount}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Agent State */}
              {agentState && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Agent State
                  </h4>
                  
                  <div className="space-y-2 text-sm">
                    {agentState.iteration_count !== undefined && (
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-gray-600">Iterations:</span>
                        <span className="font-mono text-xs font-semibold">
                          {agentState.iteration_count}
                        </span>
                      </div>
                    )}
                    
                    {agentState.processingStatus && (
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-gray-600">Status:</span>
                        <span className={`font-mono text-xs font-semibold ${
                          agentState.processingStatus === 'error' ? 'text-red-600' :
                          agentState.processingStatus === 'complete' ? 'text-green-600' :
                          'text-blue-600'
                        }`}>
                          {agentState.processingStatus}
                        </span>
                      </div>
                    )}
                    
                    {agentState.confidenceScore !== undefined && (
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-gray-600">Confidence:</span>
                        <span className={`font-mono text-xs font-semibold ${
                          agentState.confidenceScore >= 80 ? 'text-green-600' :
                          agentState.confidenceScore >= 50 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {agentState.confidenceScore}%
                        </span>
                      </div>
                    )}
                    
                    {agentState.validationErrors && agentState.validationErrors.length > 0 && (
                      <div className="p-2 bg-red-50 rounded border border-red-200">
                        <div className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Validation Errors:
                        </div>
                        <ul className="text-xs text-red-600 space-y-1">
                          {agentState.validationErrors.map((error, idx) => (
                            <li key={idx}>• {error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mentor Response */}
              {agentState?.mentor_response && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Mentor Response
                  </h4>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-gray-600">Confidence:</span>
                      <span className={`font-mono text-xs font-semibold ${
                        agentState.mentor_response.confidence >= 80 ? 'text-green-600' :
                        agentState.mentor_response.confidence >= 50 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {agentState.mentor_response.confidence}%
                      </span>
                    </div>
                    
                    {agentState.mentor_response.sources && agentState.mentor_response.sources.length > 0 && (
                      <div className="p-2 bg-blue-50 rounded border border-blue-200">
                        <div className="text-xs font-semibold text-blue-700 mb-1">Sources:</div>
                        <ul className="text-xs text-blue-600 space-y-1">
                          {agentState.mentor_response.sources.map((source, idx) => (
                            <li key={idx} className="font-mono">• {source}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Nessun dato */}
              {!telemetry && !agentState && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nessun dato di debug disponibile</p>
                  <p className="text-xs mt-1">Invia un messaggio per vedere i dati</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

