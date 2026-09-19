import type { PrismaClient } from '@prisma/client';

export interface DoctorSearchResult {
  userId: string;
  specialty: string;
  consultationFee: number;
  ratingAvg: number;
}

export interface SearchQuery {
  q?: string;
  specialty?: string;
  maxFee?: number;
  availableFrom?: string;
}

export class SearchRepository {
  constructor(private readonly db: PrismaClient) {}

  async search(query: SearchQuery): Promise<DoctorSearchResult[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.q) {
      params.push(query.q);
      conditions.push(`search_vector_computed @@ plainto_tsquery('english', $${params.length})`);
    }
    if (query.specialty) {
      params.push(query.specialty);
      conditions.push(`specialty ILIKE $${params.length}`);
    }
    if (query.maxFee !== undefined) {
      params.push(query.maxFee);
      conditions.push(`"consultationFee" <= $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT "userId", specialty, "consultationFee", "ratingAvg" FROM doctors ${where} ORDER BY "ratingAvg" DESC LIMIT 50`;

    return this.db.$queryRawUnsafe<DoctorSearchResult[]>(sql, ...params);
  }
}
