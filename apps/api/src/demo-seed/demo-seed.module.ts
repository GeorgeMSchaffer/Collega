import { Module } from '@nestjs/common'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { DemoSeedController } from './demo-seed.controller.js'

/**
 * The demo seed, exposed to a Site Admin.
 *
 * No providers of its own: the seed is a pair of functions over a `PrismaClient`, and there is no
 * use case to orchestrate. `PersistenceModule` supplies the client, which is the only dependency.
 */
@Module({
  imports: [PersistenceModule],
  controllers: [DemoSeedController],
})
export class DemoSeedModule {}
