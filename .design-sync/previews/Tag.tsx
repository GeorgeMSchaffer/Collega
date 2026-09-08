import { Tag } from '@collega/design-system'

/** The outlined chip — quieter than a Badge, and used for org-defined tags. */
export const Tags = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Tag>reporting</Tag>
    <Tag>finance</Tag>
    <Tag>needs-research</Tag>
    <Tag>q3</Tag>
  </div>
)

export const OnAnIdea = () => (
  <div className="flex max-w-lg flex-col gap-2">
    <span className="text-sm font-medium">Automate weekly reporting</span>
    <div className="flex flex-wrap items-center gap-2">
      <Tag>reporting</Tag>
      <Tag>finance</Tag>
      <Tag>time-saving</Tag>
    </div>
  </div>
)
