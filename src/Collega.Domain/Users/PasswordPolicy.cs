namespace Collega.Domain.Users;

/// <summary>
/// SPEC/20-feature-auth.md #5: "Passwords must be at least 6 characters long and include
/// uppercase, lowercase, numeric, and special characters." Applies to change-password, admin-
/// issued temporary passwords (generated to already satisfy the policy), and self-registration.
/// </summary>
public static class PasswordPolicy
{
    public const int MinLength = 6;

    public static bool IsSatisfiedBy(string? password) => Validate(password).Count == 0;

    public static IReadOnlyList<string> Validate(string? password)
    {
        var errors = new List<string>();

        if (string.IsNullOrEmpty(password))
        {
            errors.Add("Password is required.");
            return errors;
        }

        if (password.Length < MinLength)
        {
            errors.Add($"Password must be at least {MinLength} characters.");
        }

        if (!password.Any(char.IsUpper))
        {
            errors.Add("Password must include at least one uppercase letter.");
        }

        if (!password.Any(char.IsLower))
        {
            errors.Add("Password must include at least one lowercase letter.");
        }

        if (!password.Any(char.IsDigit))
        {
            errors.Add("Password must include at least one numeric character.");
        }

        if (!password.Any(ch => !char.IsLetterOrDigit(ch)))
        {
            errors.Add("Password must include at least one special character.");
        }

        return errors;
    }
}
