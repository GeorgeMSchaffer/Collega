using Collega.Domain.Ai;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

/// <summary>
/// Published versions of the idea-assist prompt (SPEC/20-feature-ai-idea-assist.md rules 34–36).
/// </summary>
/// <remarks>
/// No <c>organization_id</c>, and that is deliberate — the prompt is one deployment-wide setting, the
/// same scope as the API key (rule 29). This is the only table in the schema without organization
/// scoping, so don't read the absence as an oversight.
/// </remarks>
public sealed class AiPromptVersionConfiguration : IEntityTypeConfiguration<AiPromptVersion>
{
    public void Configure(EntityTypeBuilder<AiPromptVersion> builder)
    {
        builder.ToTable("ai_prompt_versions");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(e => e.Version)
            .HasColumnName("version")
            .IsRequired();

        // Unique so a concurrent publish collides at the database rather than silently issuing two
        // rows with the same human-facing number, which would make the history ambiguous.
        builder.HasIndex(e => e.Version)
            .IsUnique()
            .HasDatabaseName("ux_ai_prompt_versions_version");

        builder.Property(e => e.Body)
            .HasColumnName("body")
            .HasMaxLength(AiPromptVersion.BodyMaxLength)
            .IsRequired();

        builder.Property(e => e.OutOfScopeRedirect)
            .HasColumnName("out_of_scope_redirect")
            .HasMaxLength(AiPromptVersion.RedirectMaxLength)
            .IsRequired();

        builder.Property(e => e.ConversationClosedRedirect)
            .HasColumnName("conversation_closed_redirect")
            .HasMaxLength(AiPromptVersion.RedirectMaxLength)
            .IsRequired();

        builder.Property(e => e.IsActive)
            .HasColumnName("is_active")
            .IsRequired();

        // Filtered unique index: at most one active row, enforced by the database rather than by
        // remembering to deactivate first. Two active versions would make "which prompt ran" unanswerable.
        builder.HasIndex(e => e.IsActive)
            .IsUnique()
            .HasFilter("is_active")
            .HasDatabaseName("ux_ai_prompt_versions_active");

        builder.Property(e => e.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .IsRequired();

        builder.Property(e => e.CreatedByUserId)
            .HasColumnName("created_by_user_id");
    }
}
