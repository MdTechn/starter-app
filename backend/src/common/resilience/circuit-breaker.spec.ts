import { CircuitBreaker } from './circuit-breaker';

describe('CircuitBreaker', () => {
  it('opens after failure threshold', async () => {
    const breaker = new CircuitBreaker({
      name: 'test',
      failureThreshold: 2,
      resetMs: 60_000,
    });

    await expect(
      breaker.exec(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');
    await expect(
      breaker.exec(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');

    expect(breaker.getState()).toBe('open');
    await expect(breaker.exec(async () => 'ok')).rejects.toThrow(/open/);
  });

  it('resets on success', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3 });
    await expect(breaker.exec(async () => 'ok')).resolves.toBe('ok');
    expect(breaker.getState()).toBe('closed');
  });
});
