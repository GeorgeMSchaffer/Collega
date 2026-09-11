import type { NextConfig } from 'next'

const config: NextConfig = {
  // The design system ships TypeScript sources rather than a prebuilt bundle, so Next has to
  // compile it the same way it compiles the app.
  transpilePackages: ['@collega/design-system'],
  typedRoutes: true,
  experimental: {
    serverActions: {
      // The CSV imports post a file through a Server Function, and the API is the thing that
      // decides how big one may be: 5 MB, checked at its own request pipeline, answering 413
      // (`SPEC/30-Contracts.md`, bounded 2026-09-10). Next's own default is 1 MB, which would stop
      // a four-megabyte file that the contract accepts and stop it as an unattributable framework
      // error rather than as the sentence `importUsers` writes for the documented refusal. Raised
      // just past the API's bound — 5 MiB plus room for the multipart boundaries and part headers
      // that ride along — so the limit a person meets is always the one that is written down.
      bodySizeLimit: '6mb',
    },
  },
}

export default config
