declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database;
    // ASSETS is provided by Workers Static Assets in production. In tests we
    // never hit non-/api/* paths, so it stays unbound. Cast as Fetcher so the
    // src/server types stay accurate.
    ASSETS: Fetcher;
    SUBMISSIONS: R2Bucket;
    TEST_MIGRATIONS: D1Migration[];
  }
}
