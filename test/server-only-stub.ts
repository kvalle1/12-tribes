// Empty stub aliased over the `server-only` package in test runs.
//
// `server-only`'s default entry throws on import so that pulling a server-only
// module into a client bundle fails the build (the trust boundary in ADR-0009 /
// ADR-0010). Vitest runs in Node with the default condition, which would hit
// that throw, so we alias the package to this no-op for tests only — production
// builds still resolve the real package and keep enforcing the boundary.
export {};
