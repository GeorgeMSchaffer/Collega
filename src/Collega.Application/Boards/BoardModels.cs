namespace Collega.Application.Boards;

/// <summary>A requested swimlane: which status, and its position. Order is normalized densely 0..n-1.</summary>
public sealed record SwimlaneInput(Guid StatusId, int Order);

public sealed record CreateBoardCommand(string Name, bool AllowUserStatusUpdate, IReadOnlyList<SwimlaneInput> Swimlanes);

public sealed record UpdateBoardCommand(string Name, bool AllowUserStatusUpdate, IReadOnlyList<SwimlaneInput> Swimlanes);

public sealed record ReorderSwimlanesCommand(IReadOnlyList<SwimlaneInput> Swimlanes);

/// <summary>Shape matches a <c>GET /organizations/{id}/boards</c> paged/list item.</summary>
public sealed record BoardListItem(
    Guid BoardId,
    Guid OrganizationId,
    string Name,
    bool AllowUserStatusUpdate,
    int SwimlaneCount);

/// <summary>A resolved swimlane on a board detail, carrying the referenced status's display fields.</summary>
public sealed record SwimlaneDetail(
    Guid StatusId,
    string StatusName,
    string StatusColor,
    int Order,
    bool StatusIsDeleted);

/// <summary>Shape matches <c>GET /boards/{id}</c> detail.</summary>
public sealed record BoardDetail(
    Guid BoardId,
    Guid OrganizationId,
    string Name,
    bool AllowUserStatusUpdate,
    IReadOnlyList<SwimlaneDetail> Swimlanes);

/// <summary>Shape matches the <c>POST /organizations/{id}/boards</c> create response.</summary>
public sealed record CreateBoardResult(
    Guid BoardId,
    string Name,
    IReadOnlyList<SwimlaneDetail> Swimlanes);
