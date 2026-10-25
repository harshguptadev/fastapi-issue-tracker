import type { IssueStatus } from "@/client"

export const ISSUE_STATUSES: IssueStatus[] = ["Open", "In Progress", "Done"]

export const STATUS_BADGE_VARIANT: Record<
  IssueStatus,
  "default" | "secondary" | "outline"
> = {
  Open: "outline",
  "In Progress": "default",
  Done: "secondary",
}

export const PRIORITY_LABELS: Record<number, string> = {
  1: "P1 - Critical",
  2: "P2 - High",
  3: "P3 - Medium",
  4: "P4 - Low",
  5: "P5 - Trivial",
}

export const priorityLabel = (priority: number): string =>
  PRIORITY_LABELS[priority] ?? `P${priority}`

// Semantic color scale from critical (red) to trivial (gray), applied as a
// Badge className override so priority is scannable at a glance in tables,
// cards, and the Kanban board.
export const PRIORITY_BADGE_CLASS: Record<number, string> = {
  1: "border-transparent bg-red-600 text-white dark:bg-red-500",
  2: "border-transparent bg-orange-500 text-white dark:bg-orange-600",
  3: "border-transparent bg-amber-400 text-amber-950 dark:bg-amber-500 dark:text-amber-950",
  4: "border-transparent bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  5: "border-transparent bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
}

export const priorityBadgeClass = (priority: number): string =>
  PRIORITY_BADGE_CLASS[priority] ?? PRIORITY_BADGE_CLASS[5]

export type DueDateUrgency = "overdue" | "soon" | "normal" | "none"

function parseDueDate(dueDate: string): Date {
  // due_date is a plain "YYYY-MM-DD" date from the API; anchor to local
  // midnight so day-based comparisons aren't shifted by timezone offsets.
  return new Date(`${dueDate}T00:00:00`)
}

export function getDueDateUrgency(
  dueDate: string | null | undefined,
  status?: IssueStatus,
): DueDateUrgency {
  if (!dueDate) return "none"
  if (status === "Done") return "normal"

  const due = parseDueDate(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000)

  if (diffDays < 0) return "overdue"
  if (diffDays <= 3) return "soon"
  return "normal"
}

export const DUE_DATE_URGENCY_CLASS: Record<DueDateUrgency, string> = {
  overdue: "text-destructive font-medium",
  soon: "text-amber-600 dark:text-amber-500 font-medium",
  normal: "text-sm",
  none: "italic text-muted-foreground",
}

export function formatDueDate(dueDate: string | null | undefined): string {
  if (!dueDate) return "No due date"
  return parseDueDate(dueDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
