import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @collega/design-system resolves to TypeScript source rather than a dist/ build, so
  // Next compiles it with the app. That is what keeps "use client" a real directive the
  // compiler sees, and what lets Tailwind scan the components' own class strings.
  transpilePackages: ["@collega/design-system"],
  typedRoutes: true,
  // Next writes its own AGENTS.md and CLAUDE.md into this directory otherwise. The repo's
  // guidance is hand-written and lives at the root — see CLAUDE.md's progressive-disclosure
  // rule — so a generated copy here would be a second, unowned source of instructions.
  agentRules: false,
};

export default nextConfig;
