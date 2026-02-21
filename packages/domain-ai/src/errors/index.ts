export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class OrchestratorError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'OrchestratorError';
  }
}

export class ApprovalRequiredError extends OrchestratorError {
  constructor(message: string) {
    super(message);
    this.name = 'ApprovalRequiredError';
  }
}

