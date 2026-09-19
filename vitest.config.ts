import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  test: {
    environment: 'node',
    // Integration test files share one Postgres DB and each resets tables in
    // `beforeEach`. Running test files in parallel lets one file's cleanup
    // delete rows another file's in-flight request depends on (FK violations).
    // Force sequential file execution until integration tests get DB isolation.
    fileParallelism: false,
  },
});
