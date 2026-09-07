# FAQ answers

> **Provisional.** Written 2026-09-07 to replace a guideline file `SKILL.md` referenced but that was
> never committed. Sound general practice, **not verified house style.** Replace when you have the
> real convention.

## When to use

Answering a question that has been asked more than once, or that you expect to be: a rollout FAQ, a
policy explainer, the appendix to an announcement.

## Shape of one entry

**Question as the reader would ask it, answer in the first sentence.**

The single most common failure is answering the question the writer wishes had been asked. Use the
asker's words in the heading, even when they are imprecise — someone searching will search with
those words, not the correct ones.

```
### Will this break my existing scripts?

Yes, if they call the v1 endpoints directly. Those return 410 after 1 October.
Scripts that go through the SDK are unaffected — it was updated in 4.2.

<one short paragraph of detail or a link, only if it is genuinely needed>
```

Answer first, qualification second. Never the reverse.

## Rules

- **One question per entry.** If an answer needs "also", it is two entries.
- **Answer in the first sentence.** Yes, no, or the number. A reader should be able to stop there.
- **Say "we don't know yet"** when that is the answer, and name when it will be known. An FAQ that
  only contains settled questions is not the FAQ people needed.
- **Say "no"** plainly when the answer is no. Softening a refusal into ambiguity produces a second
  round of the same question.
- **Order by what will actually be asked most**, not by logical topic grouping. The scary question
  goes near the top, not in a section called "Other considerations".

## Anti-patterns

| Don't | Do |
|---|---|
| "Great question!" | Answer it. |
| Rewriting the question into precise terminology | Use the asker's words in the heading. |
| Three paragraphs before the answer | Answer, then explain. |
| Omitting the question you don't want to answer | Answer it, or say when you can. |
| "Please reach out with any questions" as an answer | That is not an answer. |
