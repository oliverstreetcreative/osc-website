// Which deployment am I? Railway injects RAILWAY_ENVIRONMENT_NAME into every
// service ("production" / "staging"). SITE_ENV is an explicit override for
// anywhere else. Only the STAGING environment is ever treated as non-public:
// production and local dev keep normal indexing.

const envName = (process.env.SITE_ENV ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? "")
  .trim()
  .toLowerCase()

/** True only on the Railway `staging` environment (or SITE_ENV=staging). */
export const IS_STAGING = envName === "staging"

/** True only on the Railway `production` environment (or SITE_ENV=production). Local dev and any other
 *  environment are NOT production: anything that reaches Sam's real queues must check this, not !IS_STAGING. */
export const IS_PRODUCTION = envName === "production"
