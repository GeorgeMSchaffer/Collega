using Collega.Application.Abstractions;
using Collega.Application.Collaboration;
using Collega.Application.Exceptions;
using Collega.Application.Fields;
using Collega.Application.Ideas;
using Collega.Application.Tests.TestDoubles;
using Collega.Domain.Enums;
using Collega.Domain.Fields;
using Collega.Domain.IdeaFields;
using Collega.Domain.Ideas;
using Collega.Domain.Organizations;
using Collega.Domain.Users;

namespace Collega.Application.Tests;

public sealed class IdeaServiceTests
{
    private readonly TestClock _clock = new();
    private readonly FakeIdeaRepository _ideas = new();
    private readonly FakeBoardReader _boardReader = new();
    private readonly FakeTagRepository _tags = new();
    private readonly FakeIdeaUpvoteRepository _upvotes = new();
    private readonly FakeCommentRepository _comments = new();
    private readonly FakeUserRepository _users = new();
    private readonly FakeFieldDefinitionRepository _fieldDefs = new();
    private readonly FakeIdeaTypeRepository _ideaTypes = new();
    private readonly FakeBusinessImpactRepository _businessImpacts = new();
    private readonly FakeUnitOfWork _uow = new();
    private readonly RecordingAuditEventWriter _audit = new();
    private readonly RecordingNotificationEventWriter _notifications = new();
    private readonly FakeCurrentUserContext _currentUser = new();

    private readonly Organization _org;
    private readonly Guid _boardId = Guid.NewGuid();
    private readonly Guid _s1 = Guid.NewGuid();
    private readonly Guid _s2 = Guid.NewGuid();
    private readonly Guid _s3 = Guid.NewGuid();
    private readonly User _author;
    private readonly IdeaType _ideaType;
    private readonly BusinessImpact _businessImpact;

    public IdeaServiceTests()
    {
        _org = Build.Organization();
        _author = _users.Add(Build.User(_org.Id, role: Role.User, email: "author@example.com"));
        _ideaType = _ideaTypes.Add(IdeaType.Create(_org.Id, "Improvement", 10, _clock.UtcNow));
        _businessImpact = _businessImpacts.Add(BusinessImpact.Create(_org.Id, "High", "#DC2626", 10, _clock.UtcNow));

        _boardReader.AddBoard(new BoardContext(_boardId, _org.Id, "Ideas", AllowUserStatusUpdate: false, new[]
        {
            new SwimlaneInfo(_s1, 0),
            new SwimlaneInfo(_s2, 1),
            new SwimlaneInfo(_s3, 2)
        }));
        _boardReader.AddStatusInfo(_org.Id, new StatusInfo(_s1, "New", "#111111", false));
        _boardReader.AddStatusInfo(_org.Id, new StatusInfo(_s2, "Doing", "#222222", false));
        _boardReader.AddStatusInfo(_org.Id, new StatusInfo(_s3, "Complete", "#333333", false));

        ActAs(Role.User, _author.Id);
    }

    private void ActAs(Role role, Guid userId)
    {
        _currentUser.IsAuthenticated = true;
        _currentUser.UserId = userId;
        _currentUser.OrganizationId = role == Role.SiteAdmin ? null : _org.Id;
        _currentUser.Role = role;
    }

    private IdeaService CreateSut() =>
        new(_ideas, _boardReader, _tags, _upvotes, _comments, _users, _fieldDefs, _ideaTypes, _businessImpacts, new MentionResolver(_users), _uow, _audit, _notifications, _currentUser, _clock);

    private CreateIdeaCommand CreateCommand(
        Guid? statusId = null,
        IReadOnlyList<Guid>? assignees = null,
        IReadOnlyList<string>? tags = null,
        IReadOnlyList<string>? mentions = null,
        string priority = "Medium") =>
        new("Title", "A valid description.", priority, _ideaType.Id, _businessImpact.Id, null, assignees, statusId, tags, mentions);

    private Idea SeedIdea(Guid statusId) =>
        _ideas.Add(Build.Idea(_org.Id, _boardId, statusId, _author.Id, ideaTypeId: _ideaType.Id, businessImpactId: _businessImpact.Id));

    // Create ------------------------------------------------------------------------------------

    [Fact]
    public async Task Create_AsReadOnly_ThrowsForbidden()
    {
        ActAs(Role.ReadOnly, Guid.NewGuid());
        var sut = CreateSut();

        await Assert.ThrowsAsync<ForbiddenAppException>(() => sut.CreateAsync(_boardId, CreateCommand()));
    }

    [Fact]
    public async Task Create_WithoutStatus_DefaultsToLeftMostSwimlane()
    {
        var sut = CreateSut();

        var result = await sut.CreateAsync(_boardId, CreateCommand());

        Assert.Equal(_s1, result.StatusId);
        Assert.Contains(_audit.Events, e => e.EventType == "IdeaCreated");
    }

    [Fact]
    public async Task Create_WithStatusNotOnBoard_ThrowsValidation()
    {
        var sut = CreateSut();
        await Assert.ThrowsAsync<ValidationAppException>(() => sut.CreateAsync(_boardId, CreateCommand(statusId: Guid.NewGuid())));
    }

    [Fact]
    public async Task Create_WithInvalidPriority_ThrowsValidation()
    {
        var sut = CreateSut();
        await Assert.ThrowsAsync<ValidationAppException>(() => sut.CreateAsync(_boardId, CreateCommand(priority: "Nope")));
    }

    [Fact]
    public async Task Create_WithTooManyAssignees_ThrowsValidation()
    {
        var extra = Enumerable.Range(0, Idea.MaxAssignees + 1)
            .Select(_ => _users.Add(Build.User(_org.Id)).Id)
            .ToList();
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() => sut.CreateAsync(_boardId, CreateCommand(assignees: extra)));
    }

    [Fact]
    public async Task Create_WithAssigneeFromAnotherOrganization_ThrowsValidation()
    {
        var foreign = _users.Add(Build.User(Guid.NewGuid()));
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() => sut.CreateAsync(_boardId, CreateCommand(assignees: new[] { foreign.Id })));
    }

    [Fact]
    public async Task Create_WithInactiveAssignee_ThrowsValidation()
    {
        var inactive = _users.Add(Build.User(_org.Id, status: UserStatus.Inactive));
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() => sut.CreateAsync(_boardId, CreateCommand(assignees: new[] { inactive.Id })));
    }

    [Fact]
    public async Task Create_NormalizesAndMergesTags()
    {
        var sut = CreateSut();

        await sut.CreateAsync(_boardId, CreateCommand(tags: new[] { "Urgent", "urgent", "  URGENT  " }));

        Assert.Single(_tags.Tags); // three spellings merge to one normalized tag
        var idea = _ideas.Ideas.Single();
        Assert.Single(idea.Tags);
    }

    [Fact]
    public async Task Create_WithTooManyTags_ThrowsValidation()
    {
        var many = Enumerable.Range(0, Idea.MaxTags + 1).Select(i => $"tag{i}").ToList();
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() => sut.CreateAsync(_boardId, CreateCommand(tags: many)));
    }

    [Fact]
    public async Task Create_UnknownBoard_ThrowsNotFound()
    {
        var sut = CreateSut();
        await Assert.ThrowsAsync<NotFoundAppException>(() => sut.CreateAsync(Guid.NewGuid(), CreateCommand()));
    }

    // ChangeStatus ------------------------------------------------------------------------------

    [Fact]
    public async Task ChangeStatus_ToStatusNotOnBoard_ThrowsValidation()
    {
        var idea = SeedIdea(_s1);
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() => sut.ChangeStatusAsync(idea.Id, new ChangeIdeaStatusCommand(Guid.NewGuid())));
    }

    [Fact]
    public async Task ChangeStatus_AsUser_WhenBoardDisallows_ThrowsForbidden()
    {
        var idea = SeedIdea(_s1);
        var sut = CreateSut(); // board.AllowUserStatusUpdate == false, current user is a User

        await Assert.ThrowsAsync<ForbiddenAppException>(() => sut.ChangeStatusAsync(idea.Id, new ChangeIdeaStatusCommand(_s2)));
    }

    [Fact]
    public async Task ChangeStatus_AsUser_WhenBoardAllows_MovesIdea()
    {
        _boardReader.Boards[_boardId] = _boardReader.Boards[_boardId] with { AllowUserStatusUpdate = true };
        var idea = SeedIdea(_s1);
        var sut = CreateSut();

        await sut.ChangeStatusAsync(idea.Id, new ChangeIdeaStatusCommand(_s2));

        Assert.Equal(_s2, idea.StatusId);
        Assert.Contains(_audit.Events, e => e.EventType == "IdeaStatusChanged");
    }

    [Fact]
    public async Task ChangeStatus_ToSameStatus_IsNoOp()
    {
        var idea = SeedIdea(_s1);
        ActAs(Role.OrgAdmin, Guid.NewGuid());
        var sut = CreateSut();

        await sut.ChangeStatusAsync(idea.Id, new ChangeIdeaStatusCommand(_s1));

        Assert.DoesNotContain(_audit.Events, e => e.EventType == "IdeaStatusChanged");
    }

    [Fact]
    public async Task ChangeStatus_AsOrgAdmin_AlwaysAllowed()
    {
        var idea = SeedIdea(_s1);
        ActAs(Role.OrgAdmin, Guid.NewGuid());
        var sut = CreateSut();

        await sut.ChangeStatusAsync(idea.Id, new ChangeIdeaStatusCommand(_s3));

        Assert.Equal(_s3, idea.StatusId);
    }

    // Update ------------------------------------------------------------------------------------

    [Fact]
    public async Task Update_DescriptionChangeByNonAuthorNonAdmin_ThrowsForbidden()
    {
        var idea = SeedIdea(_s1);
        ActAs(Role.User, Guid.NewGuid()); // a different User
        var sut = CreateSut();

        await Assert.ThrowsAsync<ForbiddenAppException>(() =>
            sut.UpdateAsync(idea.Id, new UpdateIdeaCommand("Title", "Changed description entirely.", "Medium", _ideaType.Id, _businessImpact.Id, null, null, null, null)));
    }

    [Fact]
    public async Task Update_ByAuthor_Succeeds()
    {
        var idea = SeedIdea(_s1);
        var sut = CreateSut(); // current user is the author

        var detail = await sut.UpdateAsync(idea.Id, new UpdateIdeaCommand("New Title", "A brand new description.", "High", _ideaType.Id, _businessImpact.Id, null, null, null, null));

        Assert.Equal("New Title", detail.Title);
        Assert.Equal(Priority.High.ToString(), detail.Priority);
        Assert.Contains(_audit.Events, e => e.EventType == "IdeaUpdated");
    }

    [Fact]
    public async Task Update_IdeaInCompleteStatus_RemainsEditable()
    {
        var idea = SeedIdea(_s3); // "Complete" swimlane
        var sut = CreateSut();

        var detail = await sut.UpdateAsync(idea.Id, new UpdateIdeaCommand("Still editable", "Updated after completion.", "Low", _ideaType.Id, _businessImpact.Id, null, null, null, null));

        Assert.Equal("Still editable", detail.Title);
    }

    [Fact]
    public async Task Update_WrongOrganizationScope_ThrowsNotFound()
    {
        var idea = SeedIdea(_s1);
        ActAs(Role.OrgAdmin, Guid.NewGuid());
        _currentUser.OrganizationId = Guid.NewGuid(); // different org
        var sut = CreateSut();

        await Assert.ThrowsAsync<NotFoundAppException>(() =>
            sut.UpdateAsync(idea.Id, new UpdateIdeaCommand("T", "A description.", "Low", _ideaType.Id, _businessImpact.Id, null, null, null, null)));
    }

    // Delete ------------------------------------------------------------------------------------

    [Fact]
    public async Task Delete_AsAuthorUser_ThrowsForbidden()
    {
        var idea = SeedIdea(_s1);
        var sut = CreateSut(); // author is a plain User, delete is admin-only

        await Assert.ThrowsAsync<ForbiddenAppException>(() => sut.DeleteAsync(idea.Id));
    }

    [Fact]
    public async Task Delete_AsOrgAdmin_SoftDeletes_AndExcludesFromQueries()
    {
        var idea = SeedIdea(_s1);
        ActAs(Role.OrgAdmin, Guid.NewGuid());
        var sut = CreateSut();

        await sut.DeleteAsync(idea.Id);

        Assert.True(idea.IsDeleted);
        Assert.Null(await _ideas.GetByIdAsync(idea.Id));
        Assert.Contains(_audit.Events, e => e.EventType == "IdeaDeleted");
    }

    // Upvote ------------------------------------------------------------------------------------

    [Fact]
    public async Task ToggleUpvote_AddsThenRemoves_ForSameUser()
    {
        var idea = SeedIdea(_s1);
        var sut = CreateSut();

        var added = await sut.ToggleUpvoteAsync(idea.Id);
        Assert.True(added.HasUpvoted);
        Assert.Equal(1, added.UpvoteCount);

        var removed = await sut.ToggleUpvoteAsync(idea.Id);
        Assert.False(removed.HasUpvoted);
        Assert.Equal(0, removed.UpvoteCount);
    }

    [Fact]
    public async Task ToggleUpvote_IsOnePerUser_AndOnlyCasterRemovesTheirOwn()
    {
        var idea = SeedIdea(_s1);

        // First user upvotes.
        var user1 = _author.Id;
        ActAs(Role.User, user1);
        await CreateSut().ToggleUpvoteAsync(idea.Id);

        // Second user upvotes.
        var user2 = _users.Add(Build.User(_org.Id)).Id;
        ActAs(Role.User, user2);
        var second = await CreateSut().ToggleUpvoteAsync(idea.Id);

        Assert.True(second.HasUpvoted);
        Assert.Equal(2, second.UpvoteCount);
        // Each user has exactly one active upvote row.
        Assert.Equal(2, _upvotes.Upvotes.Count);
        Assert.Single(_upvotes.Upvotes, u => u.UserId == user1);

        // Second user toggling again removes only their own; first user's remains.
        var afterRemove = await CreateSut().ToggleUpvoteAsync(idea.Id);
        Assert.Equal(1, afterRemove.UpvoteCount);
        Assert.Single(_upvotes.Upvotes, u => u.UserId == user1);
    }

    [Fact]
    public async Task ToggleUpvote_AsReadOnly_IsAllowed()
    {
        var idea = SeedIdea(_s1);
        ActAs(Role.ReadOnly, Guid.NewGuid());
        var sut = CreateSut();

        var result = await sut.ToggleUpvoteAsync(idea.Id);

        Assert.True(result.HasUpvoted);
    }

    // GetById / list projection -----------------------------------------------------------------

    [Fact]
    public async Task GetById_ProjectsStatusNameTagsAndCounts()
    {
        var idea = SeedIdea(_s2);
        var sut = CreateSut();

        var detail = await sut.GetByIdAsync(idea.Id);

        Assert.Equal("Doing", detail.StatusName);
        Assert.Equal(idea.Id, detail.IdeaId);
    }

    [Fact]
    public async Task GetById_DeletedIdea_ThrowsNotFound()
    {
        var idea = SeedIdea(_s1);
        idea.SoftDelete(_clock.UtcNow, _author.Id);
        var sut = CreateSut();

        await Assert.ThrowsAsync<NotFoundAppException>(() => sut.GetByIdAsync(idea.Id));
    }

    // Organization list: filter/sort mapping (Sprint 3) -----------------------------------------

    private OrganizationIdeaListQuery OrgQuery(
        string? search = null,
        string? scope = null,
        string? sortBy = null,
        string? sortDirection = null,
        string? tag = null,
        Guid? user = null) =>
        new(1, 50, search, scope, sortBy, sortDirection, null, tag, user);

    [Fact]
    public async Task ListByOrganization_MapsUser_ToAssociatedFilter_MatchingAuthorOrAssignee()
    {
        var other = _users.Add(Build.User(_org.Id));
        _ideas.Add(Build.Idea(_org.Id, _boardId, _s1, _author.Id, title: "Authored"));
        _ideas.Add(Build.Idea(_org.Id, _boardId, _s1, other.Id, title: "AssignedToAuthor", assignees: new[] { _author.Id }));
        _ideas.Add(Build.Idea(_org.Id, _boardId, _s1, other.Id, title: "Unrelated"));
        var sut = CreateSut();

        var page = await sut.ListByOrganizationAsync(_org.Id, OrgQuery(user: _author.Id));

        Assert.Equal(_author.Id, _ideas.LastOrganizationFilter!.AssociatedUserId);
        Assert.Equal(2, page.TotalCount);
        Assert.DoesNotContain(page.Items, i => i.Title == "Unrelated");
    }

    [Fact]
    public async Task ListByOrganization_EmptyUserGuid_IsTreatedAsNoFilter()
    {
        var sut = CreateSut();

        await sut.ListByOrganizationAsync(_org.Id, OrgQuery(user: Guid.Empty));

        Assert.Null(_ideas.LastOrganizationFilter!.AssociatedUserId);
    }

    [Fact]
    public async Task ListByOrganization_IsoDateSearch_SetsSearchCreatedOnDate()
    {
        var sut = CreateSut();

        await sut.ListByOrganizationAsync(_org.Id, OrgQuery(search: "2026-08-08"));

        Assert.Equal(new DateOnly(2026, 8, 8), _ideas.LastOrganizationFilter!.SearchCreatedOnDate);
    }

    [Fact]
    public async Task ListByOrganization_NonDateSearch_LeavesSearchCreatedOnDateNull()
    {
        var sut = CreateSut();

        await sut.ListByOrganizationAsync(_org.Id, OrgQuery(search: "onboarding"));

        Assert.Null(_ideas.LastOrganizationFilter!.SearchCreatedOnDate);
    }

    [Fact]
    public async Task ListByOrganization_TrimsTag()
    {
        var sut = CreateSut();

        await sut.ListByOrganizationAsync(_org.Id, OrgQuery(tag: "  roadmap  "));

        Assert.Equal("roadmap", _ideas.LastOrganizationFilter!.Tag);
    }

    [Fact]
    public async Task ListByOrganization_ScopeCreated_MapsCurrentUserToCreatedByFilter()
    {
        var sut = CreateSut();

        await sut.ListByOrganizationAsync(_org.Id, OrgQuery(scope: "created"));

        Assert.Equal(_author.Id, _ideas.LastOrganizationFilter!.CreatedByUserId);
        Assert.Null(_ideas.LastOrganizationFilter.AssignedToUserId);
    }

    // User-Defined Field values -----------------------------------------------------------------

    private CreateIdeaCommand FieldValueCommand(params IdeaFieldValueWrite[] values) =>
        new("Title", "A valid description.", "Medium", _ideaType.Id, _businessImpact.Id, null, null, _s1, null, null, values);

    [Fact]
    public async Task Create_MissingRequiredFieldValue_ThrowsValidation()
    {
        _fieldDefs.Add(Build.FieldDefinition(_org.Id, name: "Budget", fieldType: FieldType.Number, isRequired: true));
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() => sut.CreateAsync(_boardId, FieldValueCommand()));
    }

    [Fact]
    public async Task Create_InvalidNumberFieldValue_ThrowsValidation()
    {
        var def = _fieldDefs.Add(Build.FieldDefinition(_org.Id, name: "Budget", fieldType: FieldType.Number));
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.CreateAsync(_boardId, FieldValueCommand(new IdeaFieldValueWrite(def.Id, "not-a-number"))));
    }

    [Fact]
    public async Task Create_ValidFieldValue_PersistsAndEmitsFieldValueAudit()
    {
        var def = _fieldDefs.Add(Build.FieldDefinition(_org.Id, name: "Budget", fieldType: FieldType.Number));
        var sut = CreateSut();

        var result = await sut.CreateAsync(_boardId, FieldValueCommand(new IdeaFieldValueWrite(def.Id, "50000")));

        var idea = _ideas.Ideas.Single(i => i.Id == result.IdeaId);
        var value = Assert.Single(idea.FieldValues);
        Assert.Equal(def.Id, value.FieldDefinitionId);
        Assert.Equal("50000", value.Value);
        Assert.Contains(_audit.Events, e => e.EventType == "IdeaFieldValueChanged");
    }

    [Fact]
    public async Task Create_UnknownFieldDefinition_ThrowsValidation()
    {
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.CreateAsync(_boardId, FieldValueCommand(new IdeaFieldValueWrite(Guid.NewGuid(), "x"))));
    }

    [Fact]
    public async Task Update_WithNullFieldValues_LeavesExistingValuesUntouched_AndSkipsRequiredValidation()
    {
        var def = _fieldDefs.Add(Build.FieldDefinition(_org.Id, name: "Budget", fieldType: FieldType.Number, isRequired: true));
        var sut = CreateSut();
        var created = await sut.CreateAsync(_boardId, FieldValueCommand(new IdeaFieldValueWrite(def.Id, "50000")));

        // An unrelated edit that does not carry field values (null = "not provided") must neither wipe
        // the stored value nor be blocked by the required-field rule.
        var detail = await sut.UpdateAsync(created.IdeaId,
            new UpdateIdeaCommand("New Title", "A brand new description.", "Medium", _ideaType.Id, _businessImpact.Id, null, null, null, null));

        Assert.Equal("New Title", detail.Title);
        var idea = _ideas.Ideas.Single(i => i.Id == created.IdeaId);
        var value = Assert.Single(idea.FieldValues);
        Assert.Equal("50000", value.Value);
    }

    [Fact]
    public async Task Update_ReconcilingFieldValues_PreservesValueOfArchivedDefinition()
    {
        var active = _fieldDefs.Add(Build.FieldDefinition(_org.Id, name: "Budget", fieldType: FieldType.Number, displayOrder: 10));
        var archived = _fieldDefs.Add(Build.FieldDefinition(_org.Id, name: "Legacy", fieldType: FieldType.Text, displayOrder: 20));
        var sut = CreateSut();
        var created = await sut.CreateAsync(_boardId, FieldValueCommand(
            new IdeaFieldValueWrite(active.Id, "50000"),
            new IdeaFieldValueWrite(archived.Id, "keep-me")));

        archived.SoftDelete(_clock.UtcNow, null);

        // Reconcile the active field only; the archived definition is out of scope and its stored
        // value must survive the reconcile.
        await sut.UpdateAsync(created.IdeaId, new UpdateIdeaCommand(
            "Title", "A valid description.", "Medium", _ideaType.Id, _businessImpact.Id, null, null, null, null,
            new[] { new IdeaFieldValueWrite(active.Id, "60000") }));

        var idea = _ideas.Ideas.Single(i => i.Id == created.IdeaId);
        var byDef = idea.FieldValues.ToDictionary(v => v.FieldDefinitionId, v => v.Value);
        Assert.Equal("60000", byDef[active.Id]);
        Assert.Equal("keep-me", byDef[archived.Id]);
    }

    [Fact]
    public async Task GetById_ProjectsActiveFieldValues_AndHidesArchived()
    {
        var active = _fieldDefs.Add(Build.FieldDefinition(_org.Id, name: "Budget", fieldType: FieldType.Number, displayOrder: 10));
        var archived = _fieldDefs.Add(Build.FieldDefinition(_org.Id, name: "Legacy", fieldType: FieldType.Text, displayOrder: 20));
        var sut = CreateSut();

        var created = await sut.CreateAsync(_boardId, FieldValueCommand(
            new IdeaFieldValueWrite(active.Id, "50000"),
            new IdeaFieldValueWrite(archived.Id, "old")));

        archived.SoftDelete(_clock.UtcNow, null);

        var detail = await sut.GetByIdAsync(created.IdeaId);

        var value = Assert.Single(detail.FieldValues);
        Assert.Equal("Budget", value.FieldName);
        Assert.Equal("Number", value.FieldType);
        Assert.Equal("50000", value.Value);
    }

    [Fact]
    public async Task Create_RequiredMultiSelect_SeparatorsOnlyValue_ThrowsValidation()
    {
        // A MultiSelect made up only of separators normalizes to empty; a required field must reject it
        // instead of silently saving no value.
        var def = _fieldDefs.Add(Build.FieldDefinition(
            _org.Id, name: "Tags", fieldType: FieldType.MultiSelect, isRequired: true,
            options: new[] { new FieldOptionInput(null, "A", 0) }));
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.CreateAsync(_boardId, FieldValueCommand(new IdeaFieldValueWrite(def.Id, ","))));
    }

    [Fact]
    public async Task Create_NumberField_WithGroupSeparator_ThrowsValidation()
    {
        // "1,5" must not be silently coerced to 15 under invariant culture.
        var def = _fieldDefs.Add(Build.FieldDefinition(_org.Id, name: "Budget", fieldType: FieldType.Number));
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.CreateAsync(_boardId, FieldValueCommand(new IdeaFieldValueWrite(def.Id, "1,5"))));
    }

    // Idea-Type Fields (T061-T066) --------------------------------------------------------------

    private IdeaType CuratedType(string name, params IdeaTypeFieldInput[] links)
    {
        var type = IdeaType.Create(_org.Id, name, 20, _clock.UtcNow);
        type.SetFieldSelection(links, _clock.UtcNow, null);
        return _ideaTypes.Add(type);
    }

    private CreateIdeaCommand CreateCommandForType(Guid ideaTypeId, params IdeaFieldValueWrite[] values) =>
        new("Title", "A valid description.", "Medium", ideaTypeId, _businessImpact.Id, null, null, _s1, null, null, values);

    [Fact]
    public async Task Update_ChangingIdeaType_ThrowsValidation()
    {
        // Idea Type is immutable on the edit path: a differing ideaTypeId is rejected with 400.
        var idea = SeedIdea(_s1);
        var otherType = _ideaTypes.Add(IdeaType.Create(_org.Id, "Other", 20, _clock.UtcNow));
        ActAs(Role.OrgAdmin, _org.Id);
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.UpdateAsync(idea.Id, new UpdateIdeaCommand("Title", "A valid description.", "Medium", otherType.Id, _businessImpact.Id, null, null, null, null)));
    }

    [Fact]
    public async Task Create_ValueForFieldNotInCuratedType_ThrowsValidation()
    {
        var budget = _fieldDefs.Add(Build.FieldDefinition(_org.Id, "Budget", FieldType.Number, displayOrder: 10));
        var owner = _fieldDefs.Add(Build.FieldDefinition(_org.Id, "Owner", FieldType.Text, displayOrder: 20));
        var curated = CuratedType("Curated", new IdeaTypeFieldInput(budget.Id, 1, IsRequired: false));
        var sut = CreateSut();

        // Owner is not mapped onto this type; submitting a value for it is rejected (value scoping).
        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.CreateAsync(_boardId, CreateCommandForType(curated.Id, new IdeaFieldValueWrite(owner.Id, "Alice"))));
    }

    [Fact]
    public async Task Create_CuratedType_EnforcesPerTypeRequired_NotGlobal()
    {
        // Budget is globally optional but required in this type; Owner is globally required but unmapped.
        var budget = _fieldDefs.Add(Build.FieldDefinition(_org.Id, "Budget", FieldType.Number, isRequired: false, displayOrder: 10));
        _fieldDefs.Add(Build.FieldDefinition(_org.Id, "Owner", FieldType.Text, isRequired: true, displayOrder: 20));
        var curated = CuratedType("Curated", new IdeaTypeFieldInput(budget.Id, 1, IsRequired: true));
        var sut = CreateSut();

        // Missing the per-type-required Budget is rejected...
        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.CreateAsync(_boardId, CreateCommandForType(curated.Id)));

        // ...while the globally-required-but-unmapped Owner is not enforced for this type.
        var ok = await sut.CreateAsync(_boardId, CreateCommandForType(curated.Id, new IdeaFieldValueWrite(budget.Id, "100")));
        var idea = _ideas.Ideas.Single(i => i.Id == ok.IdeaId);
        Assert.Single(idea.FieldValues);
    }

    [Fact]
    public async Task Reassign_MovesTypeAndPreservesOutOfScopeValues()
    {
        var budget = _fieldDefs.Add(Build.FieldDefinition(_org.Id, "Budget", FieldType.Number, displayOrder: 10));
        var owner = _fieldDefs.Add(Build.FieldDefinition(_org.Id, "Owner", FieldType.Text, displayOrder: 20));
        var sut = CreateSut();

        // Created under the default AllActiveFields type with both values populated.
        var created = await sut.CreateAsync(_boardId, FieldValueCommand(
            new IdeaFieldValueWrite(budget.Id, "50000"),
            new IdeaFieldValueWrite(owner.Id, "Alice")));

        var curated = CuratedType("Curated", new IdeaTypeFieldInput(budget.Id, 1, IsRequired: false));
        ActAs(Role.OrgAdmin, _org.Id);

        await sut.ReassignIdeaTypeAsync(_org.Id, created.IdeaId, curated.Id);

        var idea = _ideas.Ideas.Single(i => i.Id == created.IdeaId);
        Assert.Equal(curated.Id, idea.IdeaTypeId);
        // Owner is out of the new type's resolved set but preserved (archived), not dropped.
        Assert.Equal(2, idea.FieldValues.Count);
        Assert.Contains(idea.FieldValues, v => v.FieldDefinitionId == owner.Id && v.Value == "Alice");
        Assert.Contains(_audit.Events, e => e.EventType == "IdeaTypeReassigned");

        // Detail surfaces the in-scope Budget value first, then the out-of-type Owner value as historical
        // (returned so the client can render it muted) — never dropped.
        var detail = await sut.GetByIdAsync(created.IdeaId);
        Assert.Equal(2, detail.FieldValues.Count);
        Assert.Equal("Budget", detail.FieldValues[0].FieldName);
        Assert.Contains(detail.FieldValues, v => v.FieldName == "Owner" && v.Value == "Alice");
    }

    [Fact]
    public async Task Reassign_AsUser_ThrowsForbidden()
    {
        var idea = SeedIdea(_s1);
        var otherType = _ideaTypes.Add(IdeaType.Create(_org.Id, "Other", 20, _clock.UtcNow));
        var sut = CreateSut(); // default actor is a plain User

        await Assert.ThrowsAsync<ForbiddenAppException>(() =>
            sut.ReassignIdeaTypeAsync(_org.Id, idea.Id, otherType.Id));
    }

    [Fact]
    public async Task Reassign_UnknownType_ThrowsValidation()
    {
        var idea = SeedIdea(_s1);
        ActAs(Role.OrgAdmin, _org.Id);
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.ReassignIdeaTypeAsync(_org.Id, idea.Id, Guid.NewGuid()));
    }

    [Fact]
    public async Task GetById_IncludesTypeAppearance()
    {
        _ideaType.SetAppearance("#1D4ED8", "rocket", _clock.UtcNow, null);
        var idea = SeedIdea(_s1);
        var sut = CreateSut();

        var detail = await sut.GetByIdAsync(idea.Id);

        Assert.Equal("#1D4ED8", detail.IdeaTypeColorHex);
        Assert.Equal("rocket", detail.IdeaTypeIcon);
    }
}
