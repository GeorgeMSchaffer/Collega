/**
 * The two auth calls the screens make, and the password rule they both enforce.
 *
 * Both endpoints are recorded, and both are recorded at particular identities — that is the
 * fact that shapes this file. `POST /auth/login` exists only as `anonymous`, which is also
 * the truthful identity for it: nobody is signed in at the moment they sign in. `POST
 * /auth/change-password` exists as `User` and as `anonymous` and at no other role, so the
 * screen names the identity it is submitting as rather than sending the browser's chosen one
 * and meeting a 501.
 *
 * `wanted` picks which recording answers. The mock cannot read a password — the corpus
 * redacted every one — so it cannot decide between the recorded 200 and the recorded 401 on
 * its own, and guessing from the form's contents would be the client deciding an
 * authentication outcome. The reviewer picks instead, out loud, in the band above the form.
 */

import { z } from "zod";

import { USE_MOCK_API, apiJson, type MockIdentity } from "@/mocks";

/** The four case kinds the corpus files a recording under; these screens use three. */
export type RecordedCase = "success" | "denied" | "invalid";

function withCase(path: string, wanted: RecordedCase): string {
  return USE_MOCK_API ? `${path}?__mockKind=${wanted}` : path;
}

/** `SPEC/20-feature-auth.md` #5, written once so the hint and the rule cannot drift apart. */
export const PASSWORD_RULE =
  "At least 6 characters, with an uppercase letter, a lowercase letter, a number and a symbol.";

export const passwordSchema = z
  .string()
  .min(6, "Use at least 6 characters.")
  .refine((value) => /[A-Z]/.test(value), "Include an uppercase letter.")
  .refine((value) => /[a-z]/.test(value), "Include a lowercase letter.")
  .refine((value) => /[0-9]/.test(value), "Include a number.")
  .refine((value) => /[^A-Za-z0-9]/.test(value), "Include a symbol.");

/** Only the fields the screens read; the recorded body carries more. */
export interface SignedIn {
  readonly requiresPasswordChange: boolean;
  readonly user: {
    readonly role: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly email: string;
  };
}

export function signIn(
  credentials: { readonly email: string; readonly password: string },
  wanted: RecordedCase,
): Promise<SignedIn> {
  return apiJson<SignedIn>(withCase("/auth/login", wanted), {
    method: "POST",
    body: credentials,
    identity: "anonymous",
  });
}

/** 204 on success, so there is nothing to return. */
export function changePassword(
  passwords: { readonly currentPassword: string; readonly newPassword: string },
  as: MockIdentity,
  wanted: RecordedCase,
): Promise<null> {
  return apiJson<null>(withCase("/auth/change-password", wanted), {
    method: "POST",
    body: passwords,
    identity: as,
  });
}
