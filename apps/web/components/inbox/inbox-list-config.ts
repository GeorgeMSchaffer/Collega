import type { ListConfig } from '@/components/list/list-state'

/**
 * The inbox's URL state: page and page size only. There is one order and no filter (rule 41), so
 * nothing else is read. A plain module, so the server page and the client list share it.
 */
export const INBOX_LIST: ListConfig = {}
