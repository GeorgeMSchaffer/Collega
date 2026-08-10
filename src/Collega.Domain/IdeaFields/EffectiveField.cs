using Collega.Domain.Fields;

namespace Collega.Domain.IdeaFields;

/// <summary>
/// A field resolved for an idea's type: the <see cref="FieldDefinition"/> to render plus its effective
/// required-ness for that type (SPEC/20-feature-idea-type-fields.md "Effective-field resolution").
/// </summary>
public sealed record EffectiveField(FieldDefinition Field, bool Required);
