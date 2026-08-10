namespace Collega.E2E.Tests.Infrastructure;

/// <summary>
/// All E2E classes join the "e2e" collection so xUnit runs them serially rather than in
/// parallel — they drive a single shared running Client/API, and parallel mutations of demo
/// data would make assertions flaky. A shared fixture can be attached here later if needed.
/// </summary>
[CollectionDefinition("e2e", DisableParallelization = true)]
public sealed class E2ECollection
{
}
