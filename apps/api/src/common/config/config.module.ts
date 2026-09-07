import { Module } from '@nestjs/common'
import { loadConfig } from './index.js'

/** DI token for the loaded, validated `Config`. A string, not the (non-existent) class - `Config`
 * is a plain object type, same reasoning as every port token in `../tokens.ts`. */
export const CONFIG = 'Config'

/**
 * Loads and validates the environment exactly once, at bootstrap, and hands the result to
 * anything that asks for `CONFIG`. `loadConfig()` throws `ConfigError` on a bad environment,
 * which Nest surfaces as a boot failure - refusing to start with an unusable configuration
 * rather than starting and failing every request is the same choice `SiteAdminConfig` already
 * makes for its two required keys.
 */
@Module({
  providers: [{ provide: CONFIG, useFactory: () => loadConfig() }],
  exports: [CONFIG],
})
export class ConfigModule {}
