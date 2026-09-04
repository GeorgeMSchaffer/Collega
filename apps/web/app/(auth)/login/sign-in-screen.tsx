"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  useForm,
  zodResolver,
} from "@collega/design-system";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { z } from "zod";

import { AuthScreen } from "@/components/auth/auth-screen";
import { RecordedCaseBand, type RecordedOption } from "@/components/auth/recorded-case-band";
import { CorpusNote } from "@/components/desk/notices";
import { signIn, type RecordedCase } from "@/lib/auth";
import { ApiError, USE_MOCK_API, isMockIdentity, useMockIdentity } from "@/mocks";

/**
 * Sign in.
 *
 * The three things Sprint 7.5 found the expensive way are structural here rather than
 * remembered: the submit control is a native `<button type="submit">`, so Enter submits from
 * either field; both inputs are bound to a real `<label for>` through `FormControl`; and the
 * email carries `autocomplete="username"` paired with `current-password` on the field below
 * it, which is the pairing a password manager needs in order to offer to save anything.
 *
 * The form does not decide whether the credentials are right — it cannot, and neither can the
 * mock, because the corpus redacted every password. It submits, and the API's own answer is
 * what appears: the recorded 401 says *Invalid email or password* and names neither, which is
 * `SPEC/20-feature-user-login.md` scenario 2 and is the API's wording, not ours.
 */

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email address."),
  password: z.string().min(1, "Enter your password."),
});

type Values = z.infer<typeof schema>;

const OUTCOMES: readonly RecordedOption[] = [
  { value: "success", label: "Signs in — 200, as Org Admin" },
  { value: "denied", label: "Incorrect email or password — 401" },
];

/** Why the viewer is back here. Comp P: three notices, one shape, none of them alerts. */
const REASONS: Record<string, string> = {
  "session-expired": "Your session expired. Sign in again to continue.",
  "password-changed": "Your password was changed. Please sign in with your new password.",
};

export function SignInScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { setIdentity } = useMockIdentity();

  const [wanted, setWanted] = React.useState<RecordedCase>("success");
  const [pending, setPending] = React.useState(false);
  const [failure, setFailure] = React.useState<ApiError | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const reason = REASONS[params.get("reason") ?? ""];

  async function onSubmit(values: Values) {
    // `aria-disabled` on the submit button is an announcement, not a barrier — it is used
    // rather than `disabled` so the control keeps its place in the tab order. Refusing the
    // second submit is therefore this function's job.
    if (pending) return;
    setPending(true);
    setFailure(null);
    try {
      const result = await signIn(values, wanted);
      // There is no session to establish. What a sign-in *can* honestly do against the
      // recordings is adopt the role the recorded response names, which is what every
      // request after this one is answered as. It is the mock identity, said out loud
      // below the form, not a claim to be authenticated.
      if (USE_MOCK_API && isMockIdentity(result.user.role)) setIdentity(result.user.role);
      router.push(result.requiresPasswordChange ? "/change-password" : "/");
    } catch (cause) {
      setFailure(
        cause instanceof ApiError
          ? cause
          : new ApiError(0, { title: "The API could not be reached.", detail: String(cause) }, null),
      );
      setPending(false);
    }
  }

  return (
    <AuthScreen
      pitchTitle="Every idea your organization has, in one place."
      pitchBody="Collega tracks an idea from the first rough note through review, work, and delivery — with the people, comments, and history attached to it the whole way."
      pitchPoints={[
        { text: "One account per person, scoped to your organization" },
        { text: "Boards, statuses and idea types you define yourself" },
        { text: "Keyboard-first: press", keys: "Ctrl K" },
      ]}
      band={
        <RecordedCaseBand
          id="login-recorded-case"
          options={OUTCOMES}
          value={wanted}
          onChange={(value) => setWanted(value as RecordedCase)}
        >
          Picks which recording of <code>POST /auth/login</code> answers.
        </RecordedCaseBand>
      }
    >
      <h1>Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        One email, one account. We&rsquo;ll take you straight to your organization.
      </p>

      {reason ? (
        <div role="status" className="mb-4 rounded-lg border bg-card px-4 py-3 text-sm">
          {reason}
        </div>
      ) : null}

      {failure ? (
        failure.isMockGap ? (
          <CorpusNote className="mb-4">{failure.message}</CorpusNote>
        ) : (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>{failure.problem?.detail ?? "Sign in failed."}</AlertTitle>
            {/* The lockout rule explains a refused credential and nothing else — saying it
                over "the API could not be reached" would blame the wrong thing. */}
            {failure.status === 401 ? (
              <AlertDescription>
                Five failed attempts within 15 minutes lock the account for 15 minutes.
              </AlertDescription>
            ) : (
              <AlertDescription>Nothing has been changed. Retrying is safe.</AlertDescription>
            )}
          </Alert>
        )
      ) : null}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  {/* type="text" with inputmode="email", as comp P has it: the browser's own
                      validation bubble would otherwise pre-empt the message below. */}
                  <Input
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    placeholder="you@yourcompany.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* aria-disabled rather than disabled: a disabled control loses focus mid-submit
              and takes its accessible name out of the tree with it. */}
          <Button type="submit" className="w-full" aria-disabled={pending} aria-busy={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Form>

      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        Have an invite code? Self-registration is specified but not built yet.
        <br />
        Forgot your password? Ask your organization admin to reset it.
      </p>

      <CorpusNote>
        there is no session behind this form. A successful sign-in replays the recorded
        response and adopts the role it names — Org Admin — as the identity every request
        after it is answered as.
      </CorpusNote>
    </AuthScreen>
  );
}
