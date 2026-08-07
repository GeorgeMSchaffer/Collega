using System.Security.Cryptography;

namespace Collega.Domain.Users;

/// <summary>
/// Generates admin-issued temporary passwords (SPEC/20-feature-auth.md #12-13) that always satisfy
/// <see cref="PasswordPolicy"/> so the recipient never hits a complexity error on first use.
/// Excludes visually ambiguous characters (0/O, 1/l/I) to reduce transcription errors when the
/// one-time value is read aloud or copied from a screen.
/// </summary>
public static class TemporaryPasswordGenerator
{
    private const string Uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private const string Lowers = "abcdefghjkmnpqrstuvwxyz";
    private const string Digits = "23456789";
    private const string Specials = "!@#$%^&*?";
    private const int Length = 12;

    public static string Generate()
    {
        var all = Uppers + Lowers + Digits + Specials;
        var chars = new char[Length];

        chars[0] = PickRandom(Uppers);
        chars[1] = PickRandom(Lowers);
        chars[2] = PickRandom(Digits);
        chars[3] = PickRandom(Specials);

        for (var i = 4; i < Length; i++)
        {
            chars[i] = PickRandom(all);
        }

        Shuffle(chars);

        return new string(chars);
    }

    private static char PickRandom(string source) => source[RandomNumberGenerator.GetInt32(source.Length)];

    private static void Shuffle(char[] chars)
    {
        for (var i = chars.Length - 1; i > 0; i--)
        {
            var j = RandomNumberGenerator.GetInt32(i + 1);
            (chars[i], chars[j]) = (chars[j], chars[i]);
        }
    }
}
