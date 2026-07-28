/**
 * Minimal circuit breaker structure (closed → open → half-open).
 * Ready for wrapping outbound calls (Stripe, SMTP, Keycloak, …).
 */
export type CircuitState = 'closed' | 'open' | 'half_open';

export type CircuitBreakerOptions = {
  failureThreshold?: number;
  resetMs?: number;
  name?: string;
};

export class CircuitBreaker {
  private failures = 0;
  private state: CircuitState = 'closed';
  private openedAt = 0;
  private readonly failureThreshold: number;
  private readonly resetMs: number;
  readonly name: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetMs = options.resetMs ?? 30_000;
    this.name = options.name ?? 'default';
  }

  getState(): CircuitState {
    this.maybeHalfOpen();
    return this.state;
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeHalfOpen();
    if (this.state === 'open') {
      throw new Error(`CircuitBreaker[${this.name}] is open`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      this.openedAt = Date.now();
    }
  }

  private maybeHalfOpen() {
    if (this.state === 'open' && Date.now() - this.openedAt >= this.resetMs) {
      this.state = 'half_open';
    }
  }
}
