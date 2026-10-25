// Must run before any module imports "@/lib/db".
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/lokal_test";
process.env.AUTH_SECRET = "test-secret-test-secret-test-secret";
