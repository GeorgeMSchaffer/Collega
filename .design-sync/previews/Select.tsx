import { Label, Select } from '@collega/design-system'

export const Default = () => (
  <div className="max-w-sm">
    <Label htmlFor="p-role">Role</Label>
    <Select id="p-role" defaultValue="member">
      <option value="administrator">Administrator</option>
      <option value="member">Member</option>
      <option value="read-only">Read-only</option>
    </Select>
  </div>
)

export const Invalid = () => (
  <div className="max-w-sm">
    <Label htmlFor="p-status">Status</Label>
    <Select id="p-status" defaultValue="" invalid>
      <option value="">Choose a status</option>
      <option value="new">New</option>
      <option value="in-review">In review</option>
      <option value="accepted">Accepted</option>
    </Select>
  </div>
)

export const Several = () => (
  <div className="flex max-w-sm flex-col gap-3">
    <div>
      <Label htmlFor="p-type">Idea type</Label>
      <Select id="p-type" defaultValue="improvement">
        <option value="improvement">Improvement</option>
        <option value="problem">Problem</option>
        <option value="question">Question</option>
      </Select>
    </div>
    <div>
      <Label htmlFor="p-board2">Board</Label>
      <Select id="p-board2" defaultValue="q3">
        <option value="q3">Q3 Intake</option>
        <option value="platform">Platform</option>
      </Select>
    </div>
  </div>
)
