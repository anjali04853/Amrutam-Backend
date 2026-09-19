import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoff } from '../../../src/common/retry';

describe('retryWithBackoff', () => {
  it('returns the result on first success without retrying', async () => {
    const fn = vi.fn(async () => 'ok');
    const result = await retryWithBackoff(fn, { attempts: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('retries on failure and succeeds within the attempt budget', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error('transient');
      return 'recovered';
    });
    const result = await retryWithBackoff(fn, { attempts: 3, baseDelayMs: 1 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws the last error once attempts are exhausted', async () => {
    const fn = vi.fn(async () => {
      throw new Error('always fails');
    });
    await expect(retryWithBackoff(fn, { attempts: 2, baseDelayMs: 1 })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
