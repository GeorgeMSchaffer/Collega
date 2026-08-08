using System.Security.Cryptography;
using Collega.Application.Abstractions;

namespace Collega.Infrastructure.Security;

/// <summary>
/// Generates random, human-friendly organization invite codes. Ambiguous characters (0/O, 1/I) are
/// excluded so a code read off a screen is easy to type. Uniqueness is enforced by the caller.
/// </summary>
public sealed class InviteCodeGenerator : IInviteCodeGenerator
{
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private const int CodeLength = 10;

    public string Generate()
    {
        Span<char> code = stackalloc char[CodeLength];
        for (var i = 0; i < CodeLength; i++)
        {
            code[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        }

        return new string(code);
    }
}
