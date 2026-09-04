"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  useForm,
  zodResolver,
} from "@collega/design-system";
import { useRouter } from "next/navigation";
import * as React from "react";
import { z } from "zod";

import { AuthScreen } from "@/components/auth/auth-screen";
import { RecordedCaseBand, type RecordedOption } from "@/components/auth/recorded-case-band";
import { CorpusNote } from "@/components/desk/notices";
import { PASSWORD_RULE, changePassword, passwordSchema, type RecordedCase } from "@/lib/auth";
import { ApiError, USE_MOCK_API, useMockIdentity, type MockIdentity } from "@/mocks";

/**
 * The forced first-login password change.
 *
 * This is a new user's second interaction with the product and the one authenticated screen
 * with no way out but through — while `MustChangePassword` is set the API refuses every
 * endpoint except this one and `GET /auth/me` (`SPEC/20-feature-auth.md` #32a). It was also
 * one of the two Blazor screens where **Enter did not submit**, which is why the submit
 * control here is a native `<button type="submit">` inside a real `<form>` and why that is
 * the first thing to check in a browser rather than the last.
 *
 * The corpus recorded `POST /auth/change-password` at two identities only — `User`, where it
 * holds both the 204 and the wrong-current-password 401, and `anonymous`, where it holds the
 * signed-out 401. Sending the browser's chosen identity would meet a 501 for the other two
 * roles, so each option in the band names the identity its recording was made at and the
 * request is submitted as that.
 */

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter the password you signed in with."),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Repeat the new password."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    error: "Must match the new password exactly.",
  });

type Values = z.infer<typeof schema>;

interface Outcome extends RecordedOption {
  readonly identity: MockIdentity;
  readonly kind: RecordedCase;
}

const OUTCOMES: readonly Outcome[] = [
  { value: "changed", label: "Password changes — 204, as Member", identity: "User", kind: "success" },
  { value: "wrong", label: "Current password is wrong — 401, as Member", identity: "User", kind: "denied" },
  { value: "signed-out", label: "Not signed in — 401, as anonymous", identity: "anonymous", kind: "denied" },
];

export function ChangePasswordScreen() {
  const router = useRouter();
  const { setIdentity } = useMockIdentity();

  const [choice, setChoice] = React.useState<string>(OUTCOMES[0]!.value);
  const [pending, setPending] = React.useState(false);
  const [failure, setFailure] = React.useState<ApiError | null>(null);

  const outcome = OUTCOMES.find((one) => one.value === choice) ?? OUTCOMES[0]!;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: Values) {
    // `aria-disabled` announces the busy state but does not block activation, and a second
    // change is not idempotent: the first one retires the current password, so the second
    // would be refused as wrong and report a failure for a change that succeeded.
    if (pending) return;
    setPending(true);
    setFailure(null);
    try {
      await changePassword(
        { currentPassword: values.currentPassword, newPassword: values.newPassword },
        outcome.identity,
        outcome.kind,
      );
      // `SPEC/20-feature-client-ui.md`: a successful required change clears client
      // authentication and returns to Login with confirmation. Here that is the mock
      // identity going back to anonymous — the same act, against what stands in for a
      // session.
      if (USE_MOCK_API) setIdentity("anonymous");
      router.push("/login?reason=password-changed");
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
      pitchTitle="Choose your own password."
      pitchBody="You signed in with a temporary password issued by an administrator. It works exactly once and expires 24 hours after it was issued. Until you replace it, nothing else in Collega will open — the server refuses every other request, not just this page."
      band={
        <RecordedCaseBand
          id="change-password-recorded-case"
          options={OUTCOMES}
          value={choice}
          onChange={setChoice}
        >
          Submits as <strong>{outcome.identity}</strong>, the identity that recording was made at.
        </RecordedCaseBand>
      }
    >
      <h1>Change your password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        For security, choose a new password before continuing.
      </p>

      {failure ? (
        failure.isMockGap ? (
          <CorpusNote className="mb-4">{failure.message}</CorpusNote>
        ) : (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>{failure.problem?.detail ?? "The password was not changed."}</AlertTitle>
            <AlertDescription>Nothing has been changed.</AlertDescription>
          </Alert>
        )
      ) : null}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="current-password" {...field} />
                </FormControl>
                <FormDescription>The temporary password you just signed in with.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormDescription>{PASSWORD_RULE}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" aria-disabled={pending} aria-busy={pending}>
            {pending ? "Saving…" : "Update password"}
          </Button>
        </form>
      </Form>

      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        Saving signs you out. Sign in again with the new password and you will land on Home.
      </p>

      <CorpusNote>
        the one recorded sign-in reports <code>requiresPasswordChange: false</code>, so this
        screen cannot be reached by signing in — the corpus never captured a first login. It is
        addressable on its own, and the band above chooses which recorded answer it gets.
      </CorpusNote>
    </AuthScreen>
  );
}
