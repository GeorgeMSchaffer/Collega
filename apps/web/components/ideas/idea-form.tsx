'use client'

import { Alert, Field, FieldRow, Input, Select, Textarea } from '@collega/design-system'
import { type FormEvent, useEffect, useId, useState, useTransition } from 'react'
import { Icon } from '@/components/list/icons'
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from '@/lib/limits'
import { saveIdea } from '@/lib/server/idea-actions'
import type { BoardRef, IdeaDetail, IdeaFormField, IdeaFormOptions } from '@/lib/types'
import { PRIORITIES } from './idea-list-config'

/**
 * The structured fields' limits (`20-feature-ideas-and-engagement.md` rule 2), transcribed because
 * the constants live in `@collega/domain`. The API enforces them; these only stop the browser
 * letting someone type past a limit they would otherwise hear about from a 400.
 */
const PROBLEM_MAX = 2000
const SOLUTION_MAX = 500
const SOLUTIONS_MAX = 5
const RATIONALE_MAX = 1000

type Draft = {
  boardId: string
  title: string
  problem: string
  solutions: string[]
  impactRationale: string
  description: string
  priority: string
  ideaTypeId: string
  businessImpactId: string
  dueDate: string
  tags: string
  /** By field id; Dropdown is an option id, MultiSelect comma-separated option ids. */
  fields: Record<string, string>
}

function initialDraft(idea: IdeaDetail | null, boardId: string | null): Draft {
  return {
    boardId: idea?.boardId ?? boardId ?? '',
    title: idea?.title ?? '',
    problem: idea?.problem ?? '',
    solutions: idea ? [...idea.proposedSolutions] : [''],
    impactRationale: idea?.impactRationale ?? '',
    description: idea?.description ?? '',
    priority: idea?.priority ?? 'Medium',
    ideaTypeId: idea?.ideaTypeId ?? '',
    businessImpactId: idea?.businessImpactId ?? '',
    dueDate: idea?.dueDate ?? '',
    tags: idea?.tags.map((tag) => tag.name).join(', ') ?? '',
    fields: Object.fromEntries(idea?.formFields.map((field) => [field.id, field.value]) ?? []),
  }
}

/** The API's own template, so a message reads the same whichever side caught it. */
const required = (name: string) => `${name} is required.`

/**
 * The idea form, for the drawer's edit and create modes (comp R, without the assistant — that is
 * phase 3): the structured fields, the classification, and the selected Idea Type's custom fields.
 *
 * It checks what is missing **for feedback only**, so a person hears about an empty Problem before
 * a round trip; the API decides. Its field-keyed 400s land beside the same fields, keyed by the
 * request's field names or, for a custom field, the field's name. Anything keyed to a field this
 * form does not show is listed above it rather than lost.
 *
 * `contentLocked` is rule 2a: only the author or an Org Admin changes the Problem, Proposed
 * solutions, Impact rationale and summary. They stay readable, read-only, and are sent back as
 * they were, which the API does not count as a change.
 *
 * The submit buttons live in the drawer's footer, outside this `<form>`, and reach it through
 * `form={formId}`.
 */
export function IdeaForm({
  formId,
  idea,
  options,
  boards,
  boardId,
  contentLocked,
  onSaved,
  onPendingChange,
}: {
  formId: string
  /** The idea being edited, or null to create one. */
  idea: IdeaDetail | null
  options: IdeaFormOptions
  /** Boards to choose from when creating with no board in context (Ideas); null otherwise. */
  boards: BoardRef[] | null
  /** The board in context when creating on a board's page. */
  boardId: string | null
  contentLocked: boolean
  onSaved: (ideaId: string) => void
  onPendingChange: (pending: boolean) => void
}) {
  const id = useId()
  const [draft, setDraft] = useState(() => initialDraft(idea, boardId))
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => onPendingChange(pending), [pending, onPendingChange])

  const editing = idea !== null
  const type = options.ideaTypes.find((t) => t.id === draft.ideaTypeId)
  // The type is fixed once created, so an edit shows the idea's own fields, which the detail
  // resolves even when the type has since been archived and left the catalog.
  const customFields = idea ? idea.formFields : (type?.fields ?? [])
  const openBoards = boards?.filter((board) => !board.isArchived) ?? null

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))
  const setField = (fieldId: string, value: string) =>
    setDraft((current) => ({ ...current, fields: { ...current.fields, [fieldId]: value } }))

  const missingCatalogs = [
    openBoards !== null && openBoards.length === 0 ? 'boards' : null,
    options.ideaTypes.length === 0 ? 'idea types' : null,
    options.businessImpacts.length === 0 ? 'business impacts' : null,
  ].filter((catalog) => catalog !== null)

  function check(): Record<string, string> {
    const found: Record<string, string> = {}
    if (openBoards !== null && !draft.boardId) found.boardId = required('Board')
    if (!draft.title.trim()) found.title = required('Title')
    if (!draft.problem.trim()) found.problem = required('Problem')
    if (!draft.solutions.some((s) => s.trim())) {
      found.proposedSolutions = 'Add at least one proposed solution.'
    }
    if (!draft.impactRationale.trim()) found.impactRationale = required('Impact Rationale')
    if (!draft.businessImpactId) found.businessImpactId = required('Business Impact')
    if (!draft.ideaTypeId) found.ideaTypeId = required('Idea Type')
    for (const field of customFields) {
      if (field.required && !draft.fields[field.id]?.trim())
        found[field.name] = required(field.name)
    }
    return found
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const found = check()
    setErrors(found)
    setError(null)
    const first = Object.keys(found)[0]
    if (first) {
      event.currentTarget
        .querySelector<HTMLElement>(`[data-error-key="${CSS.escape(first)}"]`)
        ?.focus()
      return
    }

    startTransition(async () => {
      const result = await saveIdea({
        ideaId: idea?.id ?? null,
        boardId: draft.boardId,
        title: draft.title,
        problem: draft.problem,
        proposedSolutions: draft.solutions.filter((s) => s.trim()),
        impactRationale: draft.impactRationale,
        description: draft.description,
        priority: draft.priority,
        ideaTypeId: draft.ideaTypeId,
        businessImpactId: draft.businessImpactId,
        dueDate: draft.dueDate,
        tagNames: draft.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        assigneeUserIds: idea?.assignees.map((person) => person.id) ?? [],
        mentionEmails: idea?.mentionEmails ?? [],
        fieldValues: customFields.map((field) => ({
          fieldDefinitionId: field.id,
          value: draft.fields[field.id] ?? '',
        })),
      })
      if (result.ok) {
        onSaved(result.ideaId)
      } else {
        setErrors(result.errors)
        setError(result.error)
      }
    })
  }

  // Keys this form places beside a control; the rest are listed at the top.
  const placed = new Set([
    'boardId',
    'title',
    'problem',
    'proposedSolutions',
    'impactRationale',
    'description',
    'priority',
    'ideaTypeId',
    'businessImpactId',
    'dueDate',
    'tagNames',
    ...customFields.map((field) => field.name),
  ])
  const unplaced = Object.entries(errors).filter(([key]) => !placed.has(key))

  const fid = (name: string) => `${id}-${name}`
  const lockedHint = contentLocked ? 'Only the author or an Org Admin can change this.' : undefined

  return (
    <form id={formId} noValidate onSubmit={submit} className="flex flex-col">
      {error || unplaced.length > 0 ? (
        <Alert variant="destructive" className="mb-4" role="alert">
          {error ? <span>{error}</span> : null}
          {unplaced.map(([key, message]) => (
            <span key={key}>{message}</span>
          ))}
        </Alert>
      ) : null}

      {missingCatalogs.length > 0 ? (
        <Alert variant="destructive" className="mb-4">
          <span>
            This organization has no {missingCatalogs.join(' and no ')} to choose from. An idea
            requires every one of them, so an Org Admin has to add them in Settings first.
          </span>
        </Alert>
      ) : null}

      <p className="m-0 mb-4 text-xs text-muted-foreground">
        Every field is required unless it says optional.
      </p>

      {openBoards !== null ? (
        <Field htmlFor={fid('board')} label="Board" error={errors.boardId}>
          <Select
            id={fid('board')}
            data-error-key="boardId"
            value={draft.boardId}
            onChange={(event) => set('boardId', event.target.value)}
            aria-invalid={errors.boardId ? true : undefined}
          >
            <option value="">Choose…</option>
            {openBoards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field htmlFor={fid('title')} label="Title" error={errors.title}>
        <Input
          id={fid('title')}
          data-error-key="title"
          maxLength={TITLE_MAX_LENGTH}
          value={draft.title}
          onChange={(event) => set('title', event.target.value)}
          aria-invalid={errors.title ? true : undefined}
        />
      </Field>

      <Field
        htmlFor={fid('problem')}
        label="Problem"
        hint={lockedHint ?? 'What is going wrong, for whom, and how often.'}
        error={errors.problem}
      >
        <Textarea
          id={fid('problem')}
          data-error-key="problem"
          rows={3}
          maxLength={PROBLEM_MAX}
          readOnly={contentLocked}
          value={draft.problem}
          onChange={(event) => set('problem', event.target.value)}
          aria-invalid={errors.problem ? true : undefined}
        />
      </Field>

      <SolutionsField
        idPrefix={fid('solution')}
        solutions={draft.solutions}
        locked={contentLocked}
        error={errors.proposedSolutions}
        onChange={(solutions) => set('solutions', solutions)}
      />

      <Field
        htmlFor={fid('rationale')}
        label="Impact rationale"
        hint={lockedHint ?? 'Why it matters, ideally with a number: hours, cost, incidents.'}
        error={errors.impactRationale}
      >
        <Textarea
          id={fid('rationale')}
          data-error-key="impactRationale"
          rows={2}
          maxLength={RATIONALE_MAX}
          readOnly={contentLocked}
          value={draft.impactRationale}
          onChange={(event) => set('impactRationale', event.target.value)}
          aria-invalid={errors.impactRationale ? true : undefined}
        />
      </Field>

      <FieldRow cols={3}>
        <Field htmlFor={fid('impact')} label="Business impact" error={errors.businessImpactId}>
          <Select
            id={fid('impact')}
            data-error-key="businessImpactId"
            value={draft.businessImpactId}
            onChange={(event) => set('businessImpactId', event.target.value)}
            aria-invalid={errors.businessImpactId ? true : undefined}
          >
            <option value="">Choose…</option>
            {options.businessImpacts.map((impact) => (
              <option key={impact.id} value={impact.id}>
                {impact.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          htmlFor={fid('type')}
          label="Idea type"
          hint={editing ? 'Can’t change after creation.' : undefined}
          error={errors.ideaTypeId}
        >
          {/* Immutable after creation, so shown and not offered. Its value still goes with the
              save: the API requires it and refuses a different one. */}
          <Select
            id={fid('type')}
            data-error-key="ideaTypeId"
            value={draft.ideaTypeId}
            disabled={editing}
            onChange={(event) => set('ideaTypeId', event.target.value)}
            aria-invalid={errors.ideaTypeId ? true : undefined}
          >
            <option value="">Choose…</option>
            {options.ideaTypes.map((ideaType) => (
              <option key={ideaType.id} value={ideaType.id}>
                {ideaType.name}
              </option>
            ))}
            {editing && !type && idea ? (
              <option value={idea.ideaTypeId}>{idea.ideaType}</option>
            ) : null}
          </Select>
        </Field>
        <Field htmlFor={fid('priority')} label="Priority" error={errors.priority}>
          <Select
            id={fid('priority')}
            data-error-key="priority"
            value={draft.priority}
            onChange={(event) => set('priority', event.target.value)}
            aria-invalid={errors.priority ? true : undefined}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </Select>
        </Field>
      </FieldRow>

      <FieldRow cols={2}>
        <Field htmlFor={fid('due')} label="Due date (optional)" error={errors.dueDate}>
          <Input
            id={fid('due')}
            data-error-key="dueDate"
            type="date"
            value={draft.dueDate}
            onChange={(event) => set('dueDate', event.target.value)}
            aria-invalid={errors.dueDate ? true : undefined}
          />
        </Field>
      </FieldRow>

      <Field
        htmlFor={fid('tags')}
        label="Tags (optional)"
        hint="Comma-separated, up to 10."
        error={errors.tagNames}
      >
        <Input
          id={fid('tags')}
          data-error-key="tagNames"
          value={draft.tags}
          onChange={(event) => set('tags', event.target.value)}
          aria-invalid={errors.tagNames ? true : undefined}
        />
      </Field>

      <Field
        htmlFor={fid('description')}
        label="Summary (optional)"
        hint={lockedHint ?? 'One or two lines, shown in the detail view and in exports.'}
        error={errors.description}
      >
        <Textarea
          id={fid('description')}
          data-error-key="description"
          rows={2}
          maxLength={DESCRIPTION_MAX_LENGTH}
          readOnly={contentLocked}
          value={draft.description}
          onChange={(event) => set('description', event.target.value)}
          aria-invalid={errors.description ? true : undefined}
        />
      </Field>

      <fieldset className="m-0 flex flex-col border-0 border-t p-0 pt-3">
        <legend className="float-left mb-3 w-full text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {idea ? `${idea.ideaType} fields` : type ? `${type.name} fields` : 'Custom fields'}
        </legend>
        {!idea && !type ? (
          <p className="m-0 mb-4 text-xs text-muted-foreground">
            Pick an Idea Type to see its custom fields.
          </p>
        ) : customFields.length === 0 ? (
          <p className="m-0 mb-4 text-xs text-muted-foreground">This idea type has none.</p>
        ) : (
          customFields.map((field) => (
            <CustomField
              key={field.id}
              id={fid(`field-${field.id}`)}
              field={field}
              value={draft.fields[field.id] ?? ''}
              error={errors[field.name]}
              onChange={(value) => setField(field.id, value)}
            />
          ))
        )}
      </fieldset>
    </form>
  )
}

/** One to five ordered solutions, each its own line. */
function SolutionsField({
  idPrefix,
  solutions,
  locked,
  error,
  onChange,
}: {
  idPrefix: string
  solutions: string[]
  locked: boolean
  error: string | undefined
  onChange: (solutions: string[]) => void
}) {
  const messageId = `${idPrefix}-msg`
  return (
    <fieldset
      className="m-0 mb-4 flex flex-col gap-1.5 border-0 p-0"
      data-invalid={error ? '' : undefined}
    >
      <legend className="mb-[5px] text-[length:var(--label-size)] font-medium text-secondary-foreground">
        Proposed solutions
      </legend>
      {solutions.map((solution, index) => (
        // Solutions are ordered and may repeat, so their position is their identity.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <div key={index} className="flex items-center gap-1.5">
          <Input
            id={`${idPrefix}-${index}`}
            data-error-key={index === 0 ? 'proposedSolutions' : undefined}
            aria-label={`Solution ${index + 1}`}
            aria-describedby={error || locked ? messageId : undefined}
            aria-invalid={error ? true : undefined}
            maxLength={SOLUTION_MAX}
            readOnly={locked}
            value={solution}
            onChange={(event) =>
              onChange(solutions.map((s, i) => (i === index ? event.target.value : s)))
            }
          />
          {!locked && solutions.length > 1 ? (
            <button
              type="button"
              aria-label={`Remove solution ${index + 1}`}
              onClick={() => onChange(solutions.filter((_, i) => i !== index))}
              className="inline-grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Icon name="x" />
            </button>
          ) : null}
        </div>
      ))}
      {!locked && solutions.length < SOLUTIONS_MAX ? (
        <button
          type="button"
          onClick={() => onChange([...solutions, ''])}
          className="self-start rounded-sm px-1 py-0.5 text-sm font-medium text-accent-foreground hover:underline"
        >
          + Add a solution
        </button>
      ) : null}
      {error ? (
        <span id={messageId} className="block text-xs font-semibold text-destructive">
          {error}
        </span>
      ) : locked ? (
        <span id={messageId} className="block text-xs text-muted-foreground">
          Only the author or an Org Admin can change this.
        </span>
      ) : (
        <span className="block text-xs text-muted-foreground">Up to {SOLUTIONS_MAX}.</span>
      )}
    </fieldset>
  )
}

const optionLabel = (option: IdeaFormField['options'][number]) =>
  option.archived ? `${option.label} (archived)` : option.label

/** One custom field, as its type asks to be entered. Archived options show only while chosen. */
function CustomField({
  id,
  field,
  value,
  error,
  onChange,
}: {
  id: string
  field: IdeaFormField
  value: string
  error: string | undefined
  onChange: (value: string) => void
}) {
  const label = field.required ? field.name : `${field.name} (optional)`
  const common = {
    id,
    'data-error-key': field.name,
    'aria-invalid': error ? true : undefined,
  }

  const chosen = value ? value.split(',') : []
  const options = field.options.filter((option) => !option.archived || chosen.includes(option.id))

  if (field.fieldType === 'MultiSelect') {
    return (
      <fieldset
        className="m-0 mb-4 border-0 p-0"
        data-invalid={error ? '' : undefined}
        aria-describedby={error ? `${id}-msg` : undefined}
      >
        <legend className="mb-[5px] text-[length:var(--label-size)] font-medium text-secondary-foreground">
          {label}
        </legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {options.map((option, index) => (
            <label key={option.id} className="m-0 inline-flex items-center gap-1.5 font-normal">
              <input
                type="checkbox"
                data-error-key={index === 0 ? field.name : undefined}
                checked={chosen.includes(option.id)}
                onChange={(event) =>
                  onChange(
                    (event.target.checked
                      ? [...chosen, option.id]
                      : chosen.filter((c) => c !== option.id)
                    ).join(','),
                  )
                }
              />
              {optionLabel(option)}
            </label>
          ))}
        </div>
        {error ? (
          <span id={`${id}-msg`} className="mt-1 block text-xs font-semibold text-destructive">
            {error}
          </span>
        ) : null}
      </fieldset>
    )
  }

  return (
    <Field htmlFor={id} label={label} error={error}>
      {field.fieldType === 'Dropdown' || field.fieldType === 'Boolean' ? (
        <Select {...common} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose…</option>
          {field.fieldType === 'Boolean' ? (
            <>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </>
          ) : (
            options.map((option) => (
              <option key={option.id} value={option.id}>
                {optionLabel(option)}
              </option>
            ))
          )}
        </Select>
      ) : (
        <Input
          {...common}
          type={field.fieldType === 'Date' ? 'date' : field.fieldType === 'Url' ? 'url' : 'text'}
          inputMode={field.fieldType === 'Number' ? 'decimal' : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  )
}
