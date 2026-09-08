using Collega.Application.Abstractions;
using Collega.Application.Ai;

namespace Collega.AiPlayground;

/// <summary>
/// Drives one case through the real model adapter and scores the final turn.
/// </summary>
/// <remarks>
/// The transcript is built exactly as the client builds it — user turn, model's <c>nextQuestion</c>
/// appended as the assistant turn, next user turn — so a multi-turn case exercises the same message
/// shape production sends. It does <b>not</b> go through <c>IdeaAssistService</c>: that layer adds
/// authorization, metering, rate limiting and audit, none of which is under test here, and all of
/// which would need a database.
/// </remarks>
public sealed class CaseRunner
{
    private readonly IIdeaDraftModel _model;
    private readonly IReadOnlyDictionary<string, IdeaAssistContext> _fixtures;
    private readonly WireTrace? _trace;

    public CaseRunner(
        IIdeaDraftModel model,
        IReadOnlyDictionary<string, IdeaAssistContext> fixtures,
        WireTrace? trace = null)
    {
        _model = model;
        _fixtures = fixtures;
        _trace = trace;
    }

    public async Task<AttemptResult> RunAsync(CaseFile testCase, int attempt, CancellationToken ct = default)
    {
        if (!_fixtures.TryGetValue(testCase.Fixture, out var context))
        {
            throw new InvalidOperationException(
                $"Case '{testCase.Id}' names fixture '{testCase.Fixture}', which does not exist. "
                + $"Known: {string.Join(", ", _fixtures.Keys)}");
        }

        if (testCase.Turns.Count == 0)
        {
            throw new InvalidOperationException($"Case '{testCase.Id}' has no turns.");
        }

        var transcript = new List<IdeaAssistTurn>();
        var draft = IdeaDraft.Empty;

        int input = 0, output = 0, cacheRead = 0, cacheCreate = 0;
        IdeaDraftModelResponse? last = null;
        var turnNumber = 0;

        foreach (var userTurn in testCase.Turns)
        {
            transcript.Add(new IdeaAssistTurn(IdeaAssistTurn.UserRole, userTurn));
            turnNumber++;

            if (_trace is not null)
            {
                // Set immediately before the call so the handler names the files after this turn.
                _trace.CurrentLabel = $"{testCase.Id}.attempt-{attempt}.turn-{turnNumber:00}";
            }

            try
            {
                last = await _model.ContinueAsync(context, transcript, draft, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                return new AttemptResult(
                    testCase.Id, attempt, Errored: true, Error: ex.Message,
                    Array.Empty<DimensionResult>(), input, output, cacheRead, cacheCreate,
                    transcript.Count, null);
            }

            input += last.InputTokens;
            output += last.OutputTokens;
            cacheRead += last.CacheReadInputTokens;
            cacheCreate += last.CacheCreationInputTokens;

            // A refused turn moves nothing and the client drops it from the transcript (rule 8), so the
            // harness must too — otherwise a later turn in the same case would carry context production
            // would never have sent.
            if (!last.InScope)
            {
                transcript.RemoveAt(transcript.Count - 1);
                continue;
            }

            draft = last.Draft;
            transcript.Add(new IdeaAssistTurn(IdeaAssistTurn.AssistantRole, last.NextQuestion));
        }

        var dimensions = Scorer.Score(testCase.Expect, last!, draft, context);

        return new AttemptResult(
            testCase.Id, attempt, Errored: false, Error: null, dimensions,
            input, output, cacheRead, cacheCreate, transcript.Count, last!.NextQuestion);
    }
}
