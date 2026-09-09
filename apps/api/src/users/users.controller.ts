import { AuthService, type TemporaryPasswordResult } from '@collega/application/auth'
import { type UserDetail, UserService } from '@collega/application/users'
import { Body, Controller, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import { requirePresent } from '../common/errors/request-validation.error.js'

/** `PUT /users/{userId}` request body (`SPEC/30-Contracts.md` "User Contracts"). */
type UpdateUserBody = {
  firstName?: string
  lastName?: string
  email?: string
  role?: string
  status?: string
}

/**
 * User detail, update, and the admin-issued temporary password.
 *
 * The org-scoped list, create and CSV import are deliberately **not** here - they live under
 * `/organizations/{organizationId}/users` on the organizations controller, because they are
 * scoped by the organization in the route rather than by the user in it. The .NET controller
 * says so in its own header and the contracts document agrees; splitting them differently would
 * change the routes the corpus recorded.
 *
 * Every method is authorized inside the Application services against the acting user, so this
 * controller passes the target id and nothing else. A caller outside the target's scope gets a
 * 403 or a 404 from there, not from a check written here.
 */
@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UserService,
  ) {}

  @Get(':userId')
  async getById(@Param('userId') userId: string): Promise<UserDetail> {
    return this.users.getById(userId)
  }

  @Put(':userId')
  async update(@Param('userId') userId: string, @Body() body: UpdateUserBody): Promise<UserDetail> {
    requirePresent({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      role: body.role,
      status: body.status,
    })

    return this.users.update(userId, {
      firstName: body.firstName ?? '',
      lastName: body.lastName ?? '',
      email: body.email ?? '',
      role: body.role ?? '',
      status: body.status ?? '',
    })
  }

  /**
   * 200 with the generated password in the body, not 204 - the caller has to be able to read it
   * out and hand it over, and it is never retrievable again. `AuthService` owns the rest: it
   * regenerates the target's security stamp, which invalidates every token already issued to
   * them (`SPEC/30-Contracts.md`, auth requirement #29).
   */
  @Post(':userId/temporary-password')
  @HttpCode(200)
  async issueTemporaryPassword(@Param('userId') userId: string): Promise<TemporaryPasswordResult> {
    return this.auth.issueTemporaryPassword(userId)
  }
}
