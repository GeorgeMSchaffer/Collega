import { Kbd } from '@collega/design-system'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/login-form'
import { AuthPitch } from '@/components/auth-pitch'

export const metadata = { title: 'Sign in · Collega' }

/**
 * Sign in.
 *
 * The page stays a Server Component and the form is the only client boundary — see
 * `components/auth/login-form.tsx`, which holds the accessibility contract this screen must keep.
 *
 * Reading `searchParams` is what makes this route server-rendered rather than prerendered, and it
 * is the cheaper of the two ways to notice a notice flag: `useSearchParams` in the form would need a
 * Suspense boundary around it on a static route, and that turns the sign-in form itself into a
 * client-rendered fallback. There is nothing to fetch here, so rendering per request costs a
 * template.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; registered?: string }>
}) {
  const query = await searchParams
  const expired = 'expired' in query
  const registered = 'registered' in query

  return (
    <>
      <AuthPitch
        heading="Every idea your organization has, in one place."
        points={[
          'One account per person, scoped to your organization',
          'Boards, statuses and idea types you define yourself',
          <>
            Keyboard-first: press{' '}
            <Kbd className="border-white/30 bg-white/15 text-white">Ctrl K</Kbd> anywhere
          </>,
        ]}
      >
        <p>
          Collega tracks an idea from the first rough note through review, work, and delivery — with
          the people, comments, and history attached to it the whole way.
        </p>
      </AuthPitch>

      <div className="flex flex-col justify-center bg-background px-6 py-16 sm:px-14">
        <div className="mx-auto w-full max-w-[356px]">
          <h1>Sign in</h1>
          <p className="mt-1 mb-5 text-base text-muted-foreground">
            One email, one account. We&rsquo;ll take you straight to your organization.
          </p>

          <LoginForm expired={expired} registered={registered} />

          <p className="mt-4 text-sm text-muted-foreground">
            Have an invite code? <Link href="/register">Create an account</Link>.
            <br />
            Forgot your password? Ask your organization admin to reset it.
          </p>
        </div>
      </div>
    </>
  )
}
