import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from '../../../../src/modules/search/search.service';
import type { SearchRepository } from '../../../../src/modules/search/search.repository';

function makeRedisMock() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  };
}

describe('SearchService', () => {
  it('queries the repository and caches the result on a miss', async () => {
    const repo = { search: vi.fn(async () => [{ userId: 'doc-1', specialty: 'Cardiology' }]) } as unknown as SearchRepository;
    const redis = makeRedisMock();
    const service = new SearchService(repo, redis as never);

    const result = await service.searchDoctors({ specialty: 'Cardiology' });

    expect(result).toHaveLength(1);
    expect(repo.search).toHaveBeenCalledOnce();
    expect(redis.set).toHaveBeenCalledOnce();
  });

  it('returns the cached result on a hit without querying the repository', async () => {
    const repo = { search: vi.fn(async () => [{ userId: 'doc-1' }]) } as unknown as SearchRepository;
    const redis = makeRedisMock();
    const service = new SearchService(repo, redis as never);

    await service.searchDoctors({ specialty: 'Cardiology' });
    await service.searchDoctors({ specialty: 'Cardiology' });

    expect(repo.search).toHaveBeenCalledOnce();
  });
});
