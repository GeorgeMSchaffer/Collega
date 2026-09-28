import { getIdea, getIdeaFormOptions } from '@/lib/data'
import type { IdeaDetail, IdeaFormOptions } from '@/lib/types'
import type { DrawerMode } from './idea-drawer'
import { DRAWER_PARAMS } from './idea-list-config'

type Params = Record<string, string | string[] | undefined>

const one = (params: Params, key: string) => {
  const value = params[key]
  return Array.isArray(value) ? value[0] : value
}

/**
 * What the drawer shows, read from the URL on the server: the idea, and the form's catalogs when a
 * form is open and the role may author (`canAuthor`). A form the role may not use opens as the view,
 * or not at all, rather than as a form whose save would be refused.
 *
 * `missing` is an `?idea=` the reader cannot open — deleted, another organization's, or not an id —
 * which the page reports beside the list instead of opening an empty drawer.
 */
export async function loadIdeaDrawer(
  params: Params,
  canAuthor: boolean,
): Promise<{
  mode: DrawerMode | null
  idea: IdeaDetail | null
  formOptions: IdeaFormOptions | null
  missing: boolean
}> {
  const ideaId = one(params, DRAWER_PARAMS.idea)
  const creating = one(params, DRAWER_PARAMS.create) !== undefined && canAuthor
  const editing = ideaId !== undefined && one(params, DRAWER_PARAMS.edit) !== undefined && canAuthor

  const [idea, formOptions] = await Promise.all([
    ideaId && !creating ? getIdea(ideaId) : null,
    creating || editing ? getIdeaFormOptions() : null,
  ])

  const mode: DrawerMode | null = creating ? 'create' : idea ? (editing ? 'edit' : 'view') : null

  return { mode, idea, formOptions, missing: ideaId !== undefined && !creating && idea === null }
}
