// The list-and-detail kit (comp R). Generic and presentational: no domain knowledge, no fetching.
// `list-state` is plain functions, safe on the server; everything else is a client component.
export { ConfirmDialog } from './confirm-dialog'
export { type Column, DataTable } from './data-table'
export { Drawer } from './drawer'
export {
  DEFAULT_PAGE_SIZE,
  filterRows,
  type ListConfig,
  type ListState,
  type ListView,
  listStateToQuery,
  nextSort,
  PAGE_SIZES,
  type PageSize,
  pageRows,
  readListState,
  type Sort,
  type SortDir,
  sortRows,
} from './list-state'
export { ListToolbar } from './list-toolbar'
export { type FilterOption, MultiSelectFilter } from './multi-select-filter'
export { Pager } from './pager'
export { type RowAction, RowActions } from './row-actions'
export { useListState } from './use-list-state'
export { ViewSwitch } from './view-switch'
