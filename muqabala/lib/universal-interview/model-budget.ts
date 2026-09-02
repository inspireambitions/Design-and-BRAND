export class ModelCallBudget {
  private usedCalls = 0;
  private retried = false;
  readonly maximum: number;

  constructor(maximum: number) {
    if (!Number.isInteger(maximum) || maximum < 0 || maximum > 2) {
      throw new Error('model_call_budget_must_be_between_zero_and_two');
    }
    this.maximum = maximum;
  }

  use(): void {
    if (this.usedCalls >= this.maximum) throw new Error('model_call_budget_exhausted');
    this.usedCalls += 1;
  }

  markRetry(): void {
    this.retried = true;
  }

  get used(): number {
    return this.usedCalls;
  }

  get schemaRetried(): boolean {
    return this.retried;
  }

  get remaining(): number {
    return this.maximum - this.usedCalls;
  }
}
