using Collega.Application.Exceptions;
using Collega.Application.Fields;
using Collega.Application.Tests.TestDoubles;
using Collega.Domain.Enums;
using Collega.Domain.Fields;
using Collega.Domain.Organizations;

namespace Collega.Application.Tests;

public sealed class FieldDefinitionServiceTests
{
    private readonly TestClock _clock = new();
    private readonly FakeFieldDefinitionRepository _repository = new();
    private readonly FakeOrganizationRepository _orgs = new();
    private readonly FakeUnitOfWork _uow = new();
    private readonly RecordingAuditEventWriter _audit = new();
    private readonly FakeCurrentUserContext _currentUser = new();
    private readonly Organization _org;

    public FieldDefinitionServiceTests()
    {
        _org = _orgs.Add(Build.Organization());
        _currentUser.IsAuthenticated = true;
        _currentUser.UserId = Guid.NewGuid();
        _currentUser.Role = Role.OrgAdmin;
        _currentUser.OrganizationId = _org.Id;
    }

    private FieldDefinitionService CreateSut() =>
        new(_repository, _orgs, _uow, _audit, _currentUser, _clock);

    private static CreateFieldDefinitionCommand CreateCommand(
        string name = "Budget",
        string fieldType = "Number",
        bool isRequired = false,
        IReadOnlyList<FieldOptionCommand>? options = null) =>
        new(name, null, fieldType, isRequired, null, options ?? Array.Empty<FieldOptionCommand>());

    [Fact]
    public async Task Create_AsPlainUser_ThrowsForbidden()
    {
        _currentUser.Role = Role.User;
        var sut = CreateSut();

        await Assert.ThrowsAsync<ForbiddenAppException>(() => sut.CreateAsync(_org.Id, CreateCommand()));
    }

    [Fact]
    public async Task Create_Succeeds_PersistsAndAudits()
    {
        var sut = CreateSut();

        var result = await sut.CreateAsync(_org.Id, CreateCommand("Budget", "Number", isRequired: true));

        Assert.Equal("Budget", result.Name);
        Assert.Equal("Number", result.FieldType);
        Assert.True(result.IsRequired);
        Assert.Single(_repository.Definitions);
        Assert.Contains(_audit.Events, e => e.EventType == "FieldDefinitionCreated");
    }

    [Fact]
    public async Task Create_DuplicateActiveName_ThrowsValidation()
    {
        _repository.Add(Build.FieldDefinition(_org.Id, name: "Budget", fieldType: FieldType.Number));
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() => sut.CreateAsync(_org.Id, CreateCommand("budget")));
    }

    [Fact]
    public async Task Create_InvalidFieldType_ThrowsValidation()
    {
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() => sut.CreateAsync(_org.Id, CreateCommand(fieldType: "Wormhole")));
    }

    [Fact]
    public async Task Create_DropdownWithoutOptions_ThrowsValidation()
    {
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.CreateAsync(_org.Id, CreateCommand("Department", "Dropdown", options: Array.Empty<FieldOptionCommand>())));
    }

    [Fact]
    public async Task Create_Dropdown_WithOptions_Succeeds()
    {
        var sut = CreateSut();
        var options = new[] { new FieldOptionCommand(null, "Sales", 0), new FieldOptionCommand(null, "Engineering", 1) };

        var result = await sut.CreateAsync(_org.Id, CreateCommand("Department", "Dropdown", options: options));

        Assert.Equal(2, result.Options.Count);
    }

    [Fact]
    public async Task Update_ChangingFieldType_ThrowsValidation()
    {
        var definition = _repository.Add(Build.FieldDefinition(_org.Id, name: "Budget", fieldType: FieldType.Number));
        var sut = CreateSut();

        var command = new UpdateFieldDefinitionCommand("Budget", null, "Text", false, null, Array.Empty<FieldOptionCommand>());

        await Assert.ThrowsAsync<ValidationAppException>(() => sut.UpdateAsync(_org.Id, definition.Id, command));
    }

    [Fact]
    public async Task Delete_SoftDeletes_AndIsIdempotent()
    {
        var definition = _repository.Add(Build.FieldDefinition(_org.Id));
        var sut = CreateSut();

        await sut.DeleteAsync(_org.Id, definition.Id);
        await sut.DeleteAsync(_org.Id, definition.Id);

        Assert.True(definition.IsDeleted);
        Assert.Single(_audit.Events.Where(e => e.EventType == "FieldDefinitionDeleted"));
    }

    [Fact]
    public async Task Reorder_ReassignsDisplayOrder()
    {
        var a = _repository.Add(Build.FieldDefinition(_org.Id, name: "A", displayOrder: 10));
        var b = _repository.Add(Build.FieldDefinition(_org.Id, name: "B", displayOrder: 20));
        var sut = CreateSut();

        await sut.ReorderAsync(_org.Id, new ReorderFieldDefinitionsCommand(new[] { b.Id, a.Id }));

        Assert.True(b.DisplayOrder < a.DisplayOrder);
    }

    [Fact]
    public async Task Reorder_OmittedActiveFields_GetUniqueTrailingOrder()
    {
        var a = _repository.Add(Build.FieldDefinition(_org.Id, name: "A", displayOrder: 10));
        var b = _repository.Add(Build.FieldDefinition(_org.Id, name: "B", displayOrder: 20));
        var c = _repository.Add(Build.FieldDefinition(_org.Id, name: "C", displayOrder: 30));
        var sut = CreateSut();

        // Only C and A are listed; B is omitted and must still get a distinct, trailing order.
        await sut.ReorderAsync(_org.Id, new ReorderFieldDefinitionsCommand(new[] { c.Id, a.Id }));

        Assert.True(c.DisplayOrder < a.DisplayOrder);
        Assert.True(a.DisplayOrder < b.DisplayOrder);
        Assert.Equal(3, new[] { a.DisplayOrder, b.DisplayOrder, c.DisplayOrder }.Distinct().Count());
    }

    [Fact]
    public async Task List_AsMember_ExcludesArchived()
    {
        _repository.Add(Build.FieldDefinition(_org.Id, name: "Active"));
        var archived = _repository.Add(Build.FieldDefinition(_org.Id, name: "Archived"));
        archived.SoftDelete(_clock.UtcNow, null);

        _currentUser.Role = Role.User;
        var sut = CreateSut();

        var items = await sut.ListAsync(_org.Id, includeDeleted: true); // members can't see archived even if asked

        Assert.Single(items);
        Assert.Equal("Active", items[0].Name);
    }

    [Fact]
    public async Task List_AsAdmin_IncludeDeleted_ReturnsArchived()
    {
        _repository.Add(Build.FieldDefinition(_org.Id, name: "Active"));
        var archived = _repository.Add(Build.FieldDefinition(_org.Id, name: "Archived"));
        archived.SoftDelete(_clock.UtcNow, null);
        var sut = CreateSut();

        var items = await sut.ListAsync(_org.Id, includeDeleted: true);

        Assert.Equal(2, items.Count);
    }
}
