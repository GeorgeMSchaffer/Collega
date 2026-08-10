using Collega.Application.Exceptions;
using Collega.Application.IdeaFields;
using Collega.Application.Tests.TestDoubles;
using Collega.Domain.Enums;
using Collega.Domain.Fields;
using Collega.Domain.IdeaFields;
using Collega.Domain.Organizations;

namespace Collega.Application.Tests;

public sealed class IdeaFieldServiceTests
{
    private readonly TestClock _clock = new();
    private readonly FakeIdeaTypeRepository _ideaTypes = new();
    private readonly FakeBusinessImpactRepository _businessImpacts = new();
    private readonly FakeFieldDefinitionRepository _fieldDefs = new();
    private readonly FakeOrganizationRepository _organizations = new();
    private readonly FakeUnitOfWork _uow = new();
    private readonly RecordingAuditEventWriter _audit = new();
    private readonly FakeCurrentUserContext _currentUser = new();

    private readonly Organization _org;
    private readonly IdeaType _type;
    private readonly FieldDefinition _budget;
    private readonly FieldDefinition _owner;

    public IdeaFieldServiceTests()
    {
        _org = _organizations.Add(Build.Organization());
        _type = _ideaTypes.Add(IdeaType.Create(_org.Id, "Improvement", 10, _clock.UtcNow));
        _budget = _fieldDefs.Add(Build.FieldDefinition(_org.Id, "Budget", FieldType.Number, isRequired: false, displayOrder: 10));
        _owner = _fieldDefs.Add(Build.FieldDefinition(_org.Id, "Owner", FieldType.Text, isRequired: false, displayOrder: 20));

        ActAs(Role.OrgAdmin, _org.Id);
    }

    private void ActAs(Role role, Guid? orgId)
    {
        _currentUser.IsAuthenticated = true;
        _currentUser.UserId = Guid.NewGuid();
        _currentUser.OrganizationId = orgId;
        _currentUser.Role = role;
    }

    private IdeaFieldService CreateSut() =>
        new(_ideaTypes, _businessImpacts, _fieldDefs, _organizations, _uow, _audit, _currentUser, _clock);

    // Field selection --------------------------------------------------------------------------

    [Fact]
    public async Task SetFields_WithSelection_SwitchesTypeToCurated()
    {
        var sut = CreateSut();

        await sut.SetIdeaTypeFieldsAsync(_org.Id, _type.Id, new[]
        {
            new IdeaTypeFieldSelectionInput(_budget.Id, 1, IsRequired: true),
        });

        Assert.Equal(IdeaTypeFieldMode.Curated, _type.FieldMode);
        Assert.Single(_type.Fields);
        Assert.Contains(_audit.Events, e => e.EventType == "IdeaTypeFieldsUpdated");
    }

    [Fact]
    public async Task SetFields_EmptyList_ClearsBackToAllActiveFields()
    {
        var sut = CreateSut();
        await sut.SetIdeaTypeFieldsAsync(_org.Id, _type.Id, new[] { new IdeaTypeFieldSelectionInput(_budget.Id, 1, false) });

        await sut.SetIdeaTypeFieldsAsync(_org.Id, _type.Id, Array.Empty<IdeaTypeFieldSelectionInput>());

        Assert.Equal(IdeaTypeFieldMode.AllActiveFields, _type.FieldMode);
        Assert.Empty(_type.Fields);
    }

    [Fact]
    public async Task SetFields_WithArchivedField_ThrowsValidation()
    {
        _owner.SoftDelete(_clock.UtcNow, Guid.NewGuid());
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.SetIdeaTypeFieldsAsync(_org.Id, _type.Id, new[] { new IdeaTypeFieldSelectionInput(_owner.Id, 1, false) }));
    }

    [Fact]
    public async Task SetFields_WithForeignOrgField_ThrowsValidation()
    {
        var otherOrg = _organizations.Add(Build.Organization("Other", "OTHER-1"));
        var foreign = _fieldDefs.Add(Build.FieldDefinition(otherOrg.Id, "Foreign", FieldType.Text));
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.SetIdeaTypeFieldsAsync(_org.Id, _type.Id, new[] { new IdeaTypeFieldSelectionInput(foreign.Id, 1, false) }));
    }

    [Fact]
    public async Task SetFields_WithDuplicateField_ThrowsValidation()
    {
        var sut = CreateSut();
        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.SetIdeaTypeFieldsAsync(_org.Id, _type.Id, new[]
            {
                new IdeaTypeFieldSelectionInput(_budget.Id, 1, false),
                new IdeaTypeFieldSelectionInput(_budget.Id, 2, true),
            }));
    }

    [Fact]
    public async Task SetFields_AsUser_ThrowsForbidden()
    {
        ActAs(Role.User, _org.Id);
        var sut = CreateSut();

        await Assert.ThrowsAsync<ForbiddenAppException>(() =>
            sut.SetIdeaTypeFieldsAsync(_org.Id, _type.Id, new[] { new IdeaTypeFieldSelectionInput(_budget.Id, 1, false) }));
    }

    [Fact]
    public async Task SetFields_UnknownType_ThrowsNotFound()
    {
        var sut = CreateSut();
        await Assert.ThrowsAsync<NotFoundAppException>(() =>
            sut.SetIdeaTypeFieldsAsync(_org.Id, Guid.NewGuid(), Array.Empty<IdeaTypeFieldSelectionInput>()));
    }

    // Appearance -------------------------------------------------------------------------------

    [Fact]
    public async Task SetAppearance_PersistsColorAndIcon()
    {
        var sut = CreateSut();

        await sut.SetIdeaTypeAppearanceAsync(_org.Id, _type.Id, "#1D4ED8", "rocket");

        Assert.Equal("#1D4ED8", _type.ColorHex);
        Assert.Equal("rocket", _type.Icon);
        Assert.Contains(_audit.Events, e => e.EventType == "IdeaTypeAppearanceUpdated");
    }

    [Fact]
    public async Task SetAppearance_InvalidColor_ThrowsValidation()
    {
        var sut = CreateSut();
        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.SetIdeaTypeAppearanceAsync(_org.Id, _type.Id, "not-a-color", null));
    }

    [Fact]
    public async Task SetAppearance_UnknownType_ThrowsNotFound()
    {
        var sut = CreateSut();
        await Assert.ThrowsAsync<NotFoundAppException>(() =>
            sut.SetIdeaTypeAppearanceAsync(_org.Id, Guid.NewGuid(), "#1D4ED8", null));
    }
}
