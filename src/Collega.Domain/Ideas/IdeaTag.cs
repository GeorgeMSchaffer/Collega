using Collega.Domain.Common;

namespace Collega.Domain.Ideas;

/// <summary>
/// Association between an idea and one of its organization's reusable tags
/// (SPEC/20-feature-ideas-and-engagement.md "Tags"). An idea may reference up to 10 distinct tags.
/// </summary>
public sealed class IdeaTag : EntityBase
{
    public Guid IdeaId { get; private set; }
    public Guid TagId { get; private set; }

    private IdeaTag()
    {
    }

    internal IdeaTag(Guid ideaId, Guid tagId)
    {
        IdeaId = ideaId;
        TagId = tagId;
    }
}
