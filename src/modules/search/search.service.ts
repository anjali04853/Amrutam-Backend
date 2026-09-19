import type { SearchRepository, SearchQuery, DoctorSearchResult } from './search.repository';
import type Redis from 'ioredis';

const CACHE_TTL_SECONDS = 30;

export class SearchService {
  constructor(
    private readonly repo: SearchRepository,
    private readonly redis: Redis,
  ) {}

  async searchDoctors(query: SearchQuery): Promise<DoctorSearchResult[]> {
    const cacheKey = `search:doctors:${JSON.stringify(query)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as DoctorSearchResult[];
    }
    const results = await this.repo.search(query);
    await this.redis.set(cacheKey, JSON.stringify(results), 'EX', CACHE_TTL_SECONDS);
    return results;
  }
}
