namespace Collega.Client.Services;

// Wire DTOs for the Board configuration API (SPEC/30-Contracts.md "Board Contracts").
// Kept in their own file per the client's per-area DTO convention.

/// <summary>A row of <c>GET /organizations/{id}/boards</c> (plain array).</summary>
public sealed record BoardListItemDto(
    string BoardId,
    string OrganizationId,
    string Name,
    bool AllowUserStatusUpdate,
    int SwimlaneCount);

/// <summary>A resolved swimlane on a board detail, carrying the referenced status's display fields.</summary>
public sealed record SwimlaneDetailDto(
    string StatusId,
    string StatusName,
    string StatusColor,
    int Order,
    bool StatusIsDeleted);

/// <summary>Detail for <c>GET /boards/{id}</c>, used to prefill the edit form.</summary>
public sealed record BoardDetailDto(
    string BoardId,
    string OrganizationId,
    string Name,
    bool AllowUserStatusUpdate,
    IReadOnlyList<SwimlaneDetailDto> Swimlanes);

/// <summary>A requested swimlane: which status, and its position.</summary>
public sealed record SwimlaneInputDto(string StatusId, int Order);

/// <summary>Body for both <c>POST /organizations/{id}/boards</c> and <c>PUT /boards/{id}</c>.</summary>
public sealed record SaveBoardRequestDto(string Name, bool AllowUserStatusUpdate, IReadOnlyList<SwimlaneInputDto> Swimlanes);

/// <summary>Response of <c>POST /organizations/{id}/boards</c>.</summary>
public sealed record CreateBoardResultDto(string BoardId, string Name, IReadOnlyList<SwimlaneDetailDto> Swimlanes);
