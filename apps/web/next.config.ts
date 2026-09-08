import type { NextConfig } from 'next'

const config: NextConfig = {
  // The design system ships TypeScript sources rather than a prebuilt bundle, so Next has to
  // compile it the same way it compiles the app.
  transpilePackages: ['@collega/design-system'],
  typedRoutes: true,
}

export default config
