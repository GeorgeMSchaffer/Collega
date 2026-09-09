import { Field, Input, Select, Textarea } from '@collega/design-system'

export const WithInput = () => (
  <div className="max-w-sm">
    <Field htmlFor="firstName" label="First name">
      <Input id="firstName" name="firstName" defaultValue="Dana" />
    </Field>
  </div>
)

/** The hint is bound to the control by `aria-describedby` — Field computes the id itself. */
export const WithHint = () => (
  <div className="max-w-sm">
    <Field
      htmlFor="newPassword"
      label="New password"
      hint="At least 12 characters, and different from the last one you used."
    >
      <Input id="newPassword" name="newPassword" type="password" />
    </Field>
  </div>
)

export const WithError = () => (
  <div className="max-w-sm">
    <Field
      htmlFor="boardName"
      label="Board name"
      error="A board with that name already exists in this organization."
    >
      <Input id="boardName" name="boardName" defaultValue="Q3 Intake" invalid />
    </Field>
  </div>
)

export const Controls = () => (
  <div className="max-w-sm">
    <Field htmlFor="ideaType" label="Idea type" hint="Types are configured per organization.">
      <Select id="ideaType" name="ideaType" defaultValue="improvement">
        <option value="improvement">Improvement</option>
        <option value="problem">Problem</option>
        <option value="question">Question</option>
      </Select>
    </Field>
    <Field htmlFor="summary" label="Summary">
      <Textarea
        id="summary"
        name="summary"
        rows={3}
        defaultValue="Weekly reporting takes two people a full afternoon."
      />
    </Field>
  </div>
)
