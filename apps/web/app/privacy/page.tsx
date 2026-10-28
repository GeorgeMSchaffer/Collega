import Link from 'next/link'

export const metadata = {
  title: 'Privacy · Collega',
  description: 'What Collega records about how you use it, who can see it, and how to turn it off.',
}

/**
 * The public privacy notice for usage analytics (`SPEC/20-feature-analytics.md` rule 21). Public,
 * so it sits outside both route groups: a reader sees it signed in or not. The wording is signed off
 * by the owner before `COLLEGA_USAGE_TRACKING` is turned on in production.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-[640px] px-6 py-16 text-base">
      <h1>Privacy</h1>
      <p className="mt-1 mb-8 text-muted-foreground">How Collega records what you look at.</p>

      <h2 className="mt-8 mb-2">What we record</h2>
      <p>
        To learn which parts of Collega people use, we record a short note when you view something:
        a board, an idea, a list, an admin or settings screen, or when you run a search or change a
        filter. Each note says what kind of view it was, which board or idea it was (by its id), and
        when.
      </p>
      <p className="mt-3">
        We never record what you type into a search, the values you filter by, or the text of any
        idea, comment or organization.
      </p>

      <h2 className="mt-8 mb-2">It is tied to your account</h2>
      <p>Each note is stored with your account and your organization.</p>

      <h2 className="mt-8 mb-2">How long we keep it</h2>
      <p>
        We keep these notes for 90 days. After that, they are turned into daily counts that name no
        one, and the notes themselves are deleted.
      </p>

      <h2 className="mt-8 mb-2">Who can see it</h2>
      <p>
        Collega&rsquo;s site administrators can see it. Later, your organization&rsquo;s
        administrators will be able to see totals for the organization, never what one person
        viewed. It is not shared with anyone else.
      </p>

      <h2 className="mt-8 mb-2">Nothing is stored on your device</h2>
      <p>Recording uses no cookie and no browser storage.</p>

      <h2 className="mt-8 mb-2">How to turn it off</h2>
      <p>
        Turn off <strong>Record how I use Collega</strong> in your profile. Recording stops at once.
        The changes you make, such as creating an idea, are still kept in the activity history as
        they always were.
      </p>

      <p className="mt-10 text-sm text-muted-foreground">
        <Link href="/login">Sign in</Link> · <Link href="/register">Create an account</Link>
      </p>
    </main>
  )
}
