import { describe, it, expect } from 'vitest';
import { getQueue } from '../../../src/jobs/queue';

describe('getQueue', () => {
  it('returns a BullMQ Queue instance for a known queue name', () => {
    const queue = getQueue('pdf-generation');
    expect(queue.name).toBe('pdf-generation');
  });

  it('returns the same instance on repeated calls for the same name', () => {
    const a = getQueue('notifications');
    const b = getQueue('notifications');
    expect(a).toBe(b);
  });
});
