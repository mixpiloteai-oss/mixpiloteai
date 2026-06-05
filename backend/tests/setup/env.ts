// ============================================================
// Test env setup — imported FIRST by every test file before any
// SUT code is loaded. Setting JWT_SECRET et al. here ensures that
// validateEnv() (when invoked in non-test paths) and the inline
// guards in middleware are happy.
// ============================================================
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? ('test-jwt-secret-' + 'x'.repeat(40));
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? ('test-jwt-refresh-secret-' + 'x'.repeat(40));
process.env.ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET ?? ('test-admin-jwt-secret-' + 'x'.repeat(40));
process.env.ADMIN_KEY = process.env.ADMIN_KEY ?? ('test-admin-key-' + 'x'.repeat(40));
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@test.local';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'test-admin-pass-1234';
process.env.PORT = '0';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? 'http://test.local';
// Reduce noise — morgan is already silenced for NODE_ENV=test in app.ts.
