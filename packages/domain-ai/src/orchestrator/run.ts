import type {
  AnneOrchestratorInput,
  AnneOrchestratorOutput,
  OrchestratorDependencies,
  RequestClassification,
  OrchestratorStepResult,
  RiskLevel,
  StageTraceEntry,
  ToolCall,
} from '../types/index';
import type { DomainTask, ToolPlanStep } from '../types/planning';
import type { ToolSpec } from '../types/tools';
import { evaluateApprovalPolicy } from '../policies/approval';
import { evaluateToolSafety } from '../policies/tool-safety';
import {
  runAggregatorStage,
  runCommandBuilderStage,
  runDomainDecomposerStage,
  runFinalizerStage,
  runPlannerStage,
  runRequestManagerStage,
  runTaskPlannerStage,
  runToolAnalysisStage,
  runToolArgumentStage,
  runToolCallerStage,
  StageExecutionError,
  normalizeIntentForFlowId,
  pushPolicyTrace,
  MODEL_TOKEN_ALERT_THRESHOLD,
} from './stages';

function now(deps: OrchestratorDependencies): Date {
  return deps.now ? deps.now() : new Date();
}

function maxRisk(left: RiskLevel, right: RiskLevel): RiskLevel {
  const order: Record<RiskLevel, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  return order[right] > order[left] ? right : left;
}

function buildStageTraceSummary(entries: StageTraceEntry[]) {
  const totalDurationMs = entries.reduce((sum, item) => sum + item.durationMs, 0);
  const lastStage = entries.length > 0 ? entries[entries.length - 1].stage : 'request_manager';
  const tokenInputTotal = entries.reduce((sum, item) => sum + (item.inputTokens || 0), 0);
  const tokenOutputTotal = entries.reduce((sum, item) => sum + (item.outputTokens || 0), 0);
  const tokenTotal = entries.reduce((sum, item) => sum + (item.totalTokens || 0), 0);
  const tokenAlertCount = entries.filter((item) => item.tokenAlert).length;
  return {
    lastStage,
    totalDurationMs,
    tokenUsage: {
      inputTokens: tokenInputTotal,
      outputTokens: tokenOutputTotal,
      totalTokens: tokenTotal,
      tokenAlertCount,
      tokenAlertThreshold: MODEL_TOKEN_ALERT_THRESHOLD,
    },
    entries,
  };
}

function buildFlowId(classification: RequestClassification): string {
  return `orch.${classification.domain}.${normalizeIntentForFlowId(classification.intentId)}`;
}

function buildPipelineId(input: AnneOrchestratorInput, deps: OrchestratorDependencies): string {
  const ts = now(deps).getTime();
  return `pipeline_${ts}_${input.userId.slice(0, 8)}`;
}

function buildToolPlanId(input: AnneOrchestratorInput, deps: OrchestratorDependencies): string {
  const ts = now(deps).getTime();
  return `toolplan_${ts}_${input.userId.slice(0, 8)}`;
}

function ensureDomainCatalog(catalog: ToolSpec[], classification: RequestClassification): ToolSpec[] {
  return catalog.filter((tool) => {
    if (!tool.domains || tool.domains.length === 0) return true;
    return tool.domains.includes(classification.domain);
  });
}

function buildClarificationOutput(
  pipelineId: string,
  classification: RequestClassification,
  stageTrace: StageTraceEntry[],
  message: string,
  toolPlanId?: string
): AnneOrchestratorOutput {
  return {
    message,
    clarificationRequest: message,
    metadata: {
      flowId: buildFlowId(classification),
      intentId: classification.intentId,
      channel: classification.channel,
      domain: classification.domain,
      pipelineId,
      toolPlanId,
      stageTrace: buildStageTraceSummary(stageTrace),
      riskLevel: 'low',
      approvalRequired: false,
    },
    steps: [],
  };
}

function buildControlledErrorOutput(
  classification: RequestClassification,
  pipelineId: string,
  stageTrace: StageTraceEntry[],
  message: string,
  toolPlanId?: string
): AnneOrchestratorOutput {
  return {
    message,
    metadata: {
      flowId: buildFlowId(classification),
      intentId: classification.intentId,
      channel: classification.channel,
      domain: classification.domain,
      pipelineId,
      toolPlanId,
      stageTrace: buildStageTraceSummary(stageTrace),
      riskLevel: 'low',
      approvalRequired: false,
    },
    steps: [],
  };
}

function pickToolSpec(catalog: ToolSpec[], candidates: string[], recommendedTool: string): ToolSpec | null {
  const candidateSet = new Set<string>(candidates);
  if (!candidateSet.has(recommendedTool)) return null;
  return catalog.find((tool) => tool.name === recommendedTool) || null;
}

const DIRECT_DOMAIN_TOOL_PRIORITY: Record<RequestClassification['domain'], string[]> = {
  quote: ['shipment_quote_orchestrated'],
  shipment: ['shipment_create_orchestrated'],
  support: [],
  crm: [],
  outreach: [],
  listini: ['listini_orchestrated'],
  mentor: ['mentor_orchestrated'],
  debug: ['debug_orchestrated'],
  explain: ['explain_orchestrated'],
};

const DIRECT_BYPASSED_STAGES = [
  'tool_analysis',
  'tool_argument',
  'tool_caller',
  'command_builder',
] as const;

function hasAllRequiredArgs(spec: ToolSpec, args: Record<string, unknown>): boolean {
  return spec.required.every((requiredKey) => {
    const value = args[requiredKey];
    return !(value === undefined || value === null || value === '');
  });
}

function buildDeterministicToolArgs(_spec: ToolSpec, _input: AnneOrchestratorInput): Record<string, unknown> {
  // Intentionally minimal: deterministic fast-path is enabled only when required args are already satisfiable.
  return {};
}

function chooseDirectToolCall(
  classification: RequestClassification,
  step: ToolPlanStep,
  catalog: ToolSpec[],
  input: AnneOrchestratorInput,
  stepsCount: number
): { toolSpec: ToolSpec; call: ToolCall; reason: string } | null {
  if (!step.toolCandidates || step.toolCandidates.length === 0) return null;

  const candidateSpecs = step.toolCandidates
    .map((name) => catalog.find((tool) => tool.name === name))
    .filter((tool): tool is ToolSpec => Boolean(tool));

  if (candidateSpecs.length === 0) return null;

  const candidateByName = new Map(candidateSpecs.map((tool) => [tool.name, tool] as const));

  if (stepsCount === 1 && classification.confidence >= 80) {
    for (const preferred of DIRECT_DOMAIN_TOOL_PRIORITY[classification.domain]) {
      const spec = catalog.find((tool) => tool.name === preferred);
      if (!spec) continue;

      const args = buildDeterministicToolArgs(spec, input);
      if (!hasAllRequiredArgs(spec, args)) continue;

      return {
        toolSpec: spec,
        call: {
          name: spec.name,
          arguments: args,
        },
        reason: `direct_path:domain_override:${classification.domain}:${spec.name}`,
      };
    }
  }

  const orderedNames = [
    ...DIRECT_DOMAIN_TOOL_PRIORITY[classification.domain],
    ...(step.toolCandidates.length === 1 ? [step.toolCandidates[0]] : []),
  ];

  const seen = new Set<string>();
  for (const name of orderedNames) {
    if (seen.has(name)) continue;
    seen.add(name);

    const spec = candidateByName.get(name);
    if (!spec) continue;

    const args = buildDeterministicToolArgs(spec, input);
    if (!hasAllRequiredArgs(spec, args)) continue;

    return {
      toolSpec: spec,
      call: {
        name: spec.name,
        arguments: args,
      },
      reason: `direct_path:${classification.domain}:${spec.name}`,
    };
  }

  return null;
}

function pushDirectBypassTraces(stageTrace: StageTraceEntry[]): void {
  for (const stage of DIRECT_BYPASSED_STAGES) {
    stageTrace.push({
      stage,
      attempt: 1,
      durationMs: 0,
      success: true,
      model: 'orchestrator_direct',
    });
  }
}

function mergeToolResultState(
  state: {
    message?: string;
    clarificationRequest?: string;
    pricingOptions?: unknown[];
    sessionState?: Record<string, unknown>;
    agentState?: Record<string, unknown>;
  },
  result: {
    message?: string;
    clarificationRequest?: string;
    pricingOptions?: unknown[];
    sessionState?: Record<string, unknown>;
    agentState?: Record<string, unknown>;
  }
): void {
  if (result.message) state.message = result.message;
  if (result.clarificationRequest) state.clarificationRequest = result.clarificationRequest;
  if (result.pricingOptions) state.pricingOptions = result.pricingOptions;
  if (result.sessionState) state.sessionState = result.sessionState;
  if (result.agentState) {
    state.agentState = {
      ...(state.agentState || {}),
      ...result.agentState,
    };
  }
}

export async function runAnneOrchestratorV2(
  input: AnneOrchestratorInput,
  deps: OrchestratorDependencies
): Promise<AnneOrchestratorOutput> {
  const maxAttempts = Math.max(1, deps.maxStageAttempts || 2);
  const stageTrace: StageTraceEntry[] = [];
  const pipelineId = buildPipelineId(input, deps);
  const toolPlanId = buildToolPlanId(input, deps);

  let classification: RequestClassification = {
    domain: 'support',
    channel: 'support',
    intentId: 'support.request',
    reason: 'bootstrap',
    confidence: 0,
  };

  try {
    const classificationStage = await runRequestManagerStage(input, deps, pipelineId, maxAttempts);
    classification = classificationStage.classification;
    stageTrace.push(...classificationStage.traces);

    const decomposed = await runDomainDecomposerStage(
      input,
      classification,
      deps,
      pipelineId,
      maxAttempts
    );
    stageTrace.push(...decomposed.traces);

    const plannedTasks = await runTaskPlannerStage(
      input,
      classification,
      decomposed.tasks,
      deps,
      pipelineId,
      maxAttempts
    );
    stageTrace.push(...plannedTasks.traces);

    const catalog = ensureDomainCatalog(deps.tools.catalog, classification);
    if (catalog.length === 0) {
      return buildClarificationOutput(
        pipelineId,
        classification,
        stageTrace,
        'Non ho tool disponibili per questa richiesta. Indicami un obiettivo piu specifico.',
        toolPlanId
      );
    }

    let riskLevel: RiskLevel = 'low';
    let approvalRequired = false;
    let approvalPayload: AnneOrchestratorOutput['metadata']['approvalPayload'] = undefined;

    const executionState: {
      message?: string;
      clarificationRequest?: string;
      pricingOptions?: unknown[];
      sessionState?: Record<string, unknown>;
      agentState?: Record<string, unknown>;
    } = {};

    const stepResults: OrchestratorStepResult[] = [];

    const tasks: DomainTask[] = plannedTasks.tasks;

    for (const task of tasks) {
      const plannerStage = await runPlannerStage(
        input,
        classification,
        task,
        catalog,
        deps,
        pipelineId,
        maxAttempts
      );
      stageTrace.push(...plannerStage.traces);

      const steps: ToolPlanStep[] = plannerStage.steps;

      for (const step of steps) {
        const directDecision = chooseDirectToolCall(
          classification,
          step,
          catalog,
          input,
          steps.length
        );

        let toolSpec: ToolSpec;
        let normalizedCall: ToolCall;

        if (directDecision) {
          toolSpec = directDecision.toolSpec;
          normalizedCall = directDecision.call;
          riskLevel = maxRisk(riskLevel, toolSpec.riskLevel);
          pushDirectBypassTraces(stageTrace);
          deps.logger?.log('anne_v3_direct_tool_path', {
            pipelineId,
            traceId: input.traceId,
            taskId: task.id,
            stepId: step.id,
            domain: classification.domain,
            tool: toolSpec.name,
            reason: directDecision.reason,
          });
        } else {
          const analysisStage = await runToolAnalysisStage(
            input,
            classification,
            step,
            catalog,
            deps,
            pipelineId,
            maxAttempts
          );
          stageTrace.push(...analysisStage.traces);

          const analysis = analysisStage.analysis;
          riskLevel = maxRisk(riskLevel, analysis.riskLevel);

          if (analysis.requiresClarification || analysis.missingData.length > 0) {
            const question =
              analysis.clarificationQuestion ||
              `Mi servono questi dati per procedere: ${analysis.missingData.join(', ')}`;

            return buildClarificationOutput(
              pipelineId,
              classification,
              stageTrace,
              question,
              toolPlanId
            );
          }

          const selectedTool = pickToolSpec(catalog, step.toolCandidates, analysis.recommendedTool);
          if (!selectedTool) {
            return buildClarificationOutput(
              pipelineId,
              classification,
              stageTrace,
              `Il tool suggerito (${analysis.recommendedTool}) non e consentito per questo step. Indicami meglio il risultato desiderato.`,
              toolPlanId
            );
          }

          const argumentStage = await runToolArgumentStage(
            input,
            classification,
            step,
            analysis,
            selectedTool,
            deps,
            pipelineId,
            maxAttempts
          );
          stageTrace.push(...argumentStage.traces);

          const argument = argumentStage.argument;
          if (argument.tool !== selectedTool.name) {
            return buildClarificationOutput(
              pipelineId,
              classification,
              stageTrace,
              `Non sono riuscita a preparare argomenti coerenti per ${selectedTool.name}. Puoi riformulare la richiesta?`,
              toolPlanId
            );
          }

          const callerStage = await runToolCallerStage(
            input,
            classification,
            argument,
            selectedTool,
            deps,
            pipelineId,
            maxAttempts
          );
          stageTrace.push(...callerStage.traces);

          const caller = callerStage.caller;
          if (caller.tool !== selectedTool.name) {
            return buildClarificationOutput(
              pipelineId,
              classification,
              stageTrace,
              `Il comando finale non e coerente con il tool ${selectedTool.name}. Riproviamo con piu dettaglio.`,
              toolPlanId
            );
          }

          const commandStage = await runCommandBuilderStage(
            input,
            classification,
            caller,
            selectedTool,
            deps,
            pipelineId,
            maxAttempts
          );
          stageTrace.push(...commandStage.traces);

          const command = commandStage.command;
          if (command.tool !== selectedTool.name) {
            return buildClarificationOutput(
              pipelineId,
              classification,
              stageTrace,
              `Normalizzazione comando non coerente per ${selectedTool.name}.`,
              toolPlanId
            );
          }

          toolSpec = selectedTool;
          normalizedCall = {
            name: selectedTool.name,
            arguments: command.args,
          };
        }

        const safetyStarted = Date.now();
        const safetyDecision = evaluateToolSafety(
          toolSpec,
          normalizedCall,
          {
            input,
            classification,
            pipelineId,
            taskId: task.id,
            stepId: step.id,
            stageTrace,
          }
        );

        pushPolicyTrace(
          stageTrace,
          'policy_tool_safety',
          safetyDecision.allowed,
          safetyStarted,
          safetyDecision.allowed ? undefined : 'clarification_required'
        );

        if (!safetyDecision.allowed || !safetyDecision.sanitizedCall) {
          return buildClarificationOutput(
            pipelineId,
            classification,
            stageTrace,
            safetyDecision.message || 'I parametri richiesti non sono validi per questo tool.',
            toolPlanId
          );
        }

        const approvalStarted = Date.now();
        const approvalDecision = evaluateApprovalPolicy(
          toolSpec,
          safetyDecision.sanitizedCall,
          input.message,
          now(deps)
        );
        pushPolicyTrace(
          stageTrace,
          'policy_approval',
          approvalDecision.approved,
          approvalStarted,
          approvalDecision.approved ? undefined : 'clarification_required'
        );

        riskLevel = maxRisk(riskLevel, approvalDecision.riskLevel);

        if (approvalDecision.required && !approvalDecision.approved) {
          approvalRequired = true;
          approvalPayload = approvalDecision.payload;

          const approvalMessage =
            approvalPayload?.description ||
            'Questa azione richiede conferma esplicita. Vuoi procedere?';

          return {
            message: approvalMessage,
            clarificationRequest: approvalMessage,
            metadata: {
              flowId: buildFlowId(classification),
              intentId: classification.intentId,
              channel: classification.channel,
              domain: classification.domain,
              pipelineId,
              stageTrace: buildStageTraceSummary(stageTrace),
              riskLevel,
              approvalRequired,
              toolPlanId,
              approvalPayload,
            },
            agentState: {
              ...(executionState.agentState || {}),
              pendingAction: approvalPayload,
            },
            steps: stepResults,
            pricingOptions: executionState.pricingOptions,
            sessionState: executionState.sessionState,
          };
        }

        const toolStarted = Date.now();
        const toolResult = await deps.tools.execute(safetyDecision.sanitizedCall, {
          input,
          classification,
          pipelineId,
          taskId: task.id,
          stepId: step.id,
          stageTrace,
        });
        pushPolicyTrace(
          stageTrace,
          'tool_executor',
          toolResult.success,
          toolStarted,
          toolResult.success ? undefined : 'stage_failed'
        );

        stepResults.push({
          success: toolResult.success,
          tool: safetyDecision.sanitizedCall.name,
          taskId: task.id,
          stepId: step.id,
          message: toolResult.message,
          result: toolResult.result,
          error: toolResult.error,
          riskLevel,
        });

        mergeToolResultState(executionState, toolResult);
      }
    }

    const aggregatorStage = await runAggregatorStage(
      input,
      classification,
      {
        toolPlanId,
        steps: stepResults,
        approvalRequired,
        clarificationRequest: executionState.clarificationRequest,
        pricingOptions: executionState.pricingOptions,
        sessionState: executionState.sessionState,
        agentState: executionState.agentState,
      },
      deps,
      pipelineId,
      maxAttempts
    );
    stageTrace.push(...aggregatorStage.traces);

    const finalizerStage = await runFinalizerStage(
      input,
      classification,
      aggregatorStage.aggregated,
      deps,
      pipelineId,
      maxAttempts
    );
    stageTrace.push(...finalizerStage.traces);

    const final = finalizerStage.final;
    const clarificationRequest =
      final.clarificationRequest ||
      (aggregatorStage.aggregated.clarificationRequired
        ? aggregatorStage.aggregated.clarificationQuestion
        : undefined) ||
      executionState.clarificationRequest;

    return {
      message: clarificationRequest || final.message,
      clarificationRequest,
      pricingOptions: executionState.pricingOptions,
      sessionState: {
        ...(executionState.sessionState || {}),
        ...(aggregatorStage.aggregated.sessionState || {}),
      },
      agentState: {
        ...(executionState.agentState || {}),
        ...(aggregatorStage.aggregated.agentState || {}),
      },
      metadata: {
        flowId: buildFlowId(classification),
        intentId: classification.intentId,
        channel: classification.channel,
        domain: classification.domain,
        pipelineId,
        stageTrace: buildStageTraceSummary(stageTrace),
        riskLevel,
        approvalRequired,
        toolPlanId,
        approvalPayload,
      },
      steps: stepResults,
    };
  } catch (error) {
    if (error instanceof StageExecutionError) {
      if (error.code === 'model_unavailable') {
        return buildControlledErrorOutput(
          classification,
          pipelineId,
          stageTrace,
          'Il modello richiesto non e disponibile al momento. Riprova tra qualche minuto.',
          toolPlanId
        );
      }

      return buildClarificationOutput(
        pipelineId,
        classification,
        stageTrace,
        'Non ho ricevuto un output valido dal motore AI. Puoi riformulare con piu dettagli operativi?',
        toolPlanId
      );
    }

    const message = error instanceof Error ? error.message : 'Errore sconosciuto orchestrator';
    deps.logger?.error('anne_v3_orchestrator_unhandled_error', {
      traceId: input.traceId,
      pipelineId,
      message,
    });

    return buildControlledErrorOutput(
      classification,
      pipelineId,
      stageTrace,
      'Si e verificato un errore interno durante l\'orchestrazione. Riprova tra poco.',
      toolPlanId
    );
  }
}
