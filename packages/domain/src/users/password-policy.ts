// SPEC/20-feature-auth.md #5: "Passwords must be at least 6 characters long and include
// uppercase, lowercase, numeric, and special characters." Applies to change-password,
// admin-issued temporary passwords (generated to already satisfy the policy), and
// self-registration.

export const PASSWORD_MIN_LENGTH = 6

export function validatePassword(password: string | null | undefined): readonly string[] {
  const errors: string[] = []

  if (password === null || password === undefined || password.length === 0) {
    errors.push('Password is required.')
    return errors
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must include at least one uppercase letter.')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must include at least one lowercase letter.')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must include at least one numeric character.')
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must include at least one special character.')
  }

  return errors
}

export function isPasswordPolicySatisfied(password: string | null | undefined): boolean {
  return validatePassword(password).length === 0
}
