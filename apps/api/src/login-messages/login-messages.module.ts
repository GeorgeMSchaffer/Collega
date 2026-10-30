import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '@collega/application/common'
import {
  type LoginMessageRepository,
  LoginMessageService,
} from '@collega/application/login-messages'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { LoginMessagesController } from './login-messages.controller.js'

/**
 * Sign-in messages. `useFactory` rather than `@Injectable()` because `packages/application` may not
 * import `@nestjs/common`.
 */
@Module({
  imports: [PersistenceModule, AuthModule],
  controllers: [LoginMessagesController],
  providers: [
    {
      provide: LoginMessageService,
      useFactory: (
        messages: LoginMessageRepository,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) => new LoginMessageService(messages, unitOfWork, auditEvents, currentUser, clock),
      inject: [
        PORT_TOKENS.LoginMessageRepository,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
  ],
})
export class LoginMessagesModule {}
