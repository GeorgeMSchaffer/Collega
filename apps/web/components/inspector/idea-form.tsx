"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@collega/design-system";
import * as React from "react";

import { Marker } from "@/components/desk/marker";
import { AssigneePicker, FormField, TagPicker } from "@/components/inspector/fields";
import { useWrite } from "@/components/inspector/use-write";
import { useApi } from "@/lib/api";
import { PRIORITY_COLORS } from "@/lib/format";
import { PRIORITIES, type Assignee, type BusinessImpact, type Member, type Priority } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";
import type { ApiError } from "@/mocks";

/**
 * The idea field set, which create and edit share because the contracts do.
 *
 * `POST /boards/{boardId}/ideas` and `PUT /ideas/{ideaId}` take the same body
 * (`SPEC/30-Contracts.md`) apart from one rule: **idea type is immutable after creation** and a
 * `PUT` carrying a different one is a 400, so on the edit path the type is shown rather than
 * chosen. The admin break-glass reassignment is a different endpoint and is not this form.
 *
 * Validation is client-side and required, not belt-and-braces. The corpus does hold the real
 * 400 for a missing title, but under the `invalid` case kind, which the mock serves only when
 * asked for by name — submit a blank title here and the recording answers `201`. Letting that
 * through would demonstrate the opposite of the rule.
 */

export interface IdeaFormValues {
  title: string;
  description: string;
  priority: Priority;
  ideaTypeId: string;
  businessImpactId: string;
  statusId: string;
  dueDate: string;
  tagNames: readonly string[];
  assignees: readonly Assignee[];
}

const TITLE_MAX = 150;
const DESCRIPTION_MAX = 4000;

interface Problems {
  title?: string;
  description?: string;
  ideaTypeId?: string;
  businessImpactId?: string;
}

function validate(values: IdeaFormValues): Problems {
  const problems: Problems = {};
  if (values.title.trim().length === 0) problems.title = "A title is required.";
  else if (values.title.length > TITLE_MAX) problems.title = `Titles are limited to ${TITLE_MAX} characters.`;
  if (values.description.trim().length === 0) problems.description = "A description is required.";
  else if (values.description.length > DESCRIPTION_MAX)
    problems.description = `Descriptions are limited to ${DESCRIPTION_MAX} characters.`;
  if (values.ideaTypeId.length === 0) problems.ideaTypeId = "Choose an idea type.";
  if (values.businessImpactId.length === 0) problems.businessImpactId = "Choose a business impact.";
  return problems;
}

/**
 * Field-level messages from a `validation-error` problem+json, keyed as the API keys them.
 *
 * Only keys that actually carry a message are set. A key present with `undefined` would still
 * win the spread below and blank out the client-side message for that field, leaving a form
 * that refuses to submit with nothing on screen saying which field is wrong.
 */
function serverProblems(error: ApiError | null): Problems {
  const errors = (error?.problem as { errors?: Record<string, string[]> } | null)?.errors;
  if (!errors) return {};
  const problems: Problems = {};
  for (const key of ["title", "description", "ideaTypeId", "businessImpactId"] as const) {
    const message = errors[key]?.[0] ?? errors[key.charAt(0).toUpperCase() + key.slice(1)]?.[0];
    if (message) problems[key] = message;
  }
  return problems;
}

export function IdeaForm({
  values,
  onChange,
  onCancel,
  onSaved,
  submit,
  submitLabel,
  busyLabel,
  typeIsFixed,
  showStatus,
  descriptionNote,
}: {
  values: IdeaFormValues;
  onChange: (next: IdeaFormValues) => void;
  onCancel: () => void;
  onSaved: (outcome: { exact: boolean }) => void;
  submit: { path: string; method: string };
  submitLabel: string;
  busyLabel: string;
  /** True on the edit path: idea type is chosen at creation and immutable after. */
  typeIsFixed: boolean;
  showStatus: boolean;
  descriptionNote?: React.ReactNode;
}) {
  const { organizationId, statuses, ideaTypes } = useWorkspace();
  const impacts = useApi<BusinessImpact[]>(
    organizationId ? `/organizations/${organizationId}/business-impacts` : null,
  );
  const members = useApi<Member[]>(organizationId ? `/organizations/${organizationId}/members` : null);
  const tags = useApi<string[]>(organizationId ? `/organizations/${organizationId}/tags` : null);

  const [touched, setTouched] = React.useState(false);
  const write = useWrite(submit.path, submit.method);
  const ids = React.useId();

  // The form only ever appears because somebody pressed New idea or Edit idea, so putting the
  // caret in the first field is finishing the action they started rather than stealing focus.
  // Done with a ref rather than `autoFocus`, which jsx-a11y rejects for the cases where it is
  // not — a page that grabs focus on load.
  const titleRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => titleRef.current?.focus(), []);

  const local = validate(values);
  const fromServer = serverProblems(write.error);
  const problems: Problems = touched ? { ...local, ...fromServer } : fromServer;

  const set = <K extends keyof IdeaFormValues>(key: K, value: IdeaFormValues[K]) =>
    onChange({ ...values, [key]: value });

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Enter submits from any single-line field, so the button's `disabled` is not the only way in.
    if (write.state === "running") return;
    setTouched(true);
    if (Object.keys(local).length > 0) return;

    const result = await write.run({
      body: {
        title: values.title.trim(),
        description: values.description.trim(),
        priority: values.priority,
        ideaTypeId: values.ideaTypeId,
        businessImpactId: values.businessImpactId,
        ...(showStatus && values.statusId ? { statusId: values.statusId } : {}),
        ...(values.dueDate ? { dueDate: values.dueDate } : {}),
        assigneeUserIds: values.assignees.map((one) => one.userId),
        tagNames: values.tagNames,
      },
    });
    if (result) onSaved({ exact: result.exact });
  };

  const chosenType = ideaTypes.find((type) => type.ideaTypeId === values.ideaTypeId);
  const impactList = impacts.data ?? [];

  return (
    // A real form, so Enter from any single-line field submits it — the tag box being the one
    // deliberate exception, and only while it has something in it to add.
    //
    // `@container`, not a viewport breakpoint: this form lives in a panel the viewer can drag
    // between 20% and 48% of the window, so `sm:` would put two columns side by side in a
    // 350px column on a wide screen and clip "Business impact" to "Business i…". The pairing
    // below keys off the panel's own width instead.
    <form className="@container flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)} noValidate>
      {write.error ? (
        <Alert variant={write.error.isRefusal ? "warning" : "destructive"}>
          <AlertTitle>{write.error.problem?.title ?? "That could not be saved"}</AlertTitle>
          <AlertDescription>
            {write.error.problem?.detail ?? "Nothing was saved. Retrying is safe."}
          </AlertDescription>
        </Alert>
      ) : null}

      <FormField
        id={`${ids}-title`}
        label="Title"
        required
        error={problems.title}
        counter={`${values.title.length} / ${TITLE_MAX}`}
      >
        <Input
          id={`${ids}-title`}
          ref={titleRef}
          value={values.title}
          maxLength={TITLE_MAX}
          aria-invalid={problems.title !== undefined || undefined}
          aria-describedby={problems.title ? `${ids}-title-error` : undefined}
          onChange={(event) => set("title", event.target.value)}
        />
      </FormField>

      <FormField
        id={`${ids}-description`}
        label="Description"
        required
        error={problems.description}
        hint={descriptionNote}
        counter={`${values.description.length} / ${DESCRIPTION_MAX}`}
      >
        <Textarea
          id={`${ids}-description`}
          value={values.description}
          rows={5}
          maxLength={DESCRIPTION_MAX}
          aria-invalid={problems.description !== undefined || undefined}
          aria-describedby={
            problems.description ? `${ids}-description-error` : descriptionNote ? `${ids}-description-hint` : undefined
          }
          onChange={(event) => set("description", event.target.value)}
        />
      </FormField>

      {typeIsFixed ? (
        <FormField
          id={`${ids}-type`}
          label="Idea type"
          hint="Set at creation and immutable after. An administrator can reassign it from the read view."
        >
          <div
            id={`${ids}-type`}
            className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm"
          >
            <Marker wrap color={chosenType?.colorHex}>{chosenType?.name ?? "Not recorded"}</Marker>
          </div>
        </FormField>
      ) : (
        <FormField
          id={`${ids}-type`}
          label="Idea type"
          required
          error={problems.ideaTypeId}
          hint="Set at creation and immutable after."
        >
          <Select value={values.ideaTypeId} onValueChange={(value) => set("ideaTypeId", value)}>
            <SelectTrigger id={`${ids}-type`} aria-invalid={problems.ideaTypeId !== undefined || undefined}>
              <SelectValue placeholder="Choose a type" />
            </SelectTrigger>
            <SelectContent>
              {/* Active options only. An archived value stays visible on an idea that already
                  carries it, but the contract rejects a create or edit that newly selects one. */}
              {ideaTypes
                .filter((type) => !type.isDeleted)
                .map((type) => (
                  <SelectItem key={type.ideaTypeId} value={type.ideaTypeId}>
                    {type.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </FormField>
      )}

      <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
        <FormField id={`${ids}-impact`} label="Business impact" required error={problems.businessImpactId}>
          <Select value={values.businessImpactId} onValueChange={(value) => set("businessImpactId", value)}>
            <SelectTrigger id={`${ids}-impact`} aria-invalid={problems.businessImpactId !== undefined || undefined}>
              <SelectValue placeholder={impacts.state === "loading" ? "Loading…" : "Choose an impact"} />
            </SelectTrigger>
            <SelectContent>
              {impactList
                .filter((impact) => !impact.isDeleted)
                .map((impact) => (
                  <SelectItem key={impact.businessImpactId} value={impact.businessImpactId}>
                    {impact.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField id={`${ids}-priority`} label="Priority">
          <Select value={values.priority} onValueChange={(value) => set("priority", value as Priority)}>
            <SelectTrigger id={`${ids}-priority`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {priority}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        {showStatus ? (
          // Empty means *unset*, and unset is not sent — which is what makes the contract's
          // "defaults to the left-most swimlane when omitted" actually happen. Pre-selecting a
          // status would send one on every create and retire that rule silently.
          //
          // The options are the organization's statuses, not the target board's swimlanes: a
          // board's own lanes come from `GET /boards/{boardId}`, which the capture recorded
          // against one board, so asking for them would answer with another board's. A status
          // that is not a lane on this board is a 400, and the hint says so rather than the
          // form pretending to know.
          <FormField
            id={`${ids}-status`}
            label="Status"
            hint="Left as it is, the idea lands in the board’s left-most lane. These are the organization’s statuses; one that is not a lane on this board is refused."
          >
            <Select value={values.statusId} onValueChange={(value) => set("statusId", value)}>
              <SelectTrigger id={`${ids}-status`} aria-describedby={`${ids}-status-hint`}>
                <SelectValue placeholder="Left-most lane" />
              </SelectTrigger>
              <SelectContent>
                {statuses
                  .filter((status) => !status.isDeleted)
                  .map((status) => (
                    <SelectItem key={status.statusId} value={status.statusId}>
                      {status.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormField>
        ) : null}

        <FormField id={`${ids}-due`} label="Due date">
          <Input
            id={`${ids}-due`}
            type="date"
            value={values.dueDate}
            onChange={(event) => set("dueDate", event.target.value)}
          />
        </FormField>
      </div>

      <AssigneePicker
        id={`${ids}-assignees`}
        value={values.assignees}
        members={members.data ?? []}
        onChange={(next) => set("assignees", next)}
      />

      <TagPicker
        id={`${ids}-tags`}
        value={values.tagNames}
        suggestions={tags.data ?? []}
        onChange={(next) => set("tagNames", next)}
      />

      {/* Priority's colour is decoration; the word beside it is the meaning. Shown here so the
          form's chosen values read the same way the card and the list do. */}
      <p className="m-0 flex items-center gap-2 text-xs text-muted-foreground">
        Priority reads as <Marker color={PRIORITY_COLORS[values.priority]}>{values.priority}</Marker> on the
        board.
      </p>

      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={write.state === "running"}>
          {write.state === "running" ? busyLabel : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
