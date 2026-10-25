import { Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { Check, Copy } from "lucide-react"

import type { IssuePublic } from "@/client"
import { SortableHeader } from "@/components/Common/DataTable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import useAuth from "@/hooks/useAuth"
import { IssueActionsMenu } from "./IssueActionsMenu"
import {
  DUE_DATE_URGENCY_CLASS,
  formatDueDate,
  getDueDateUrgency,
  priorityBadgeClass,
  priorityLabel,
  STATUS_BADGE_VARIANT,
} from "./issueDisplay"

function CopyId({ id }: { id: string }) {
  const [copiedText, copy] = useCopyToClipboard()
  const isCopied = copiedText === id

  return (
    <div className="flex items-center gap-1.5 group">
      <span className="font-mono text-xs text-muted-foreground">{id}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => copy(id)}
      >
        {isCopied ? (
          <Check className="size-3 text-green-500" />
        ) : (
          <Copy className="size-3" />
        )}
        <span className="sr-only">Copy ID</span>
      </Button>
    </div>
  )
}

function IssueRowActions({ issue }: { issue: IssuePublic }) {
  const { user } = useAuth()
  const isOwner = user?.is_superuser || user?.id === issue.owner_id

  if (!isOwner) {
    return null
  }

  return <IssueActionsMenu issue={issue} />
}

function compareNullableStrings(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a.localeCompare(b)
}

export const columns: ColumnDef<IssuePublic>[] = [
  {
    accessorKey: "id",
    header: "ID",
    enableSorting: false,
    cell: ({ row }) => <CopyId id={row.original.id} />,
  },
  {
    accessorKey: "title",
    header: ({ column }) => (
      <SortableHeader column={column}>Title</SortableHeader>
    ),
    cell: ({ row }) => (
      <Link
        to="/issues/$issueId"
        params={{ issueId: row.original.id }}
        className="font-medium hover:underline"
      >
        {row.original.title}
      </Link>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <SortableHeader column={column}>Status</SortableHeader>
    ),
    cell: ({ row }) => {
      const status = row.original.status ?? "Open"
      return <Badge variant={STATUS_BADGE_VARIANT[status]}>{status}</Badge>
    },
  },
  {
    accessorKey: "priority",
    header: ({ column }) => (
      <SortableHeader column={column}>Priority</SortableHeader>
    ),
    cell: ({ row }) => {
      const priority = row.original.priority ?? 3
      return (
        <Badge className={priorityBadgeClass(priority)}>
          {priorityLabel(priority)}
        </Badge>
      )
    },
  },
  {
    accessorKey: "due_date",
    header: ({ column }) => (
      <SortableHeader column={column}>Due date</SortableHeader>
    ),
    sortingFn: (rowA, rowB) =>
      compareNullableStrings(
        rowA.original.due_date ?? null,
        rowB.original.due_date ?? null,
      ),
    cell: ({ row }) => {
      const issue = row.original
      const urgency = getDueDateUrgency(issue.due_date, issue.status)
      return (
        <span className={`text-sm ${DUE_DATE_URGENCY_CLASS[urgency]}`}>
          {formatDueDate(issue.due_date)}
        </span>
      )
    },
  },
  {
    accessorKey: "assignee_email",
    header: ({ column }) => (
      <SortableHeader column={column}>Assignee</SortableHeader>
    ),
    sortingFn: (rowA, rowB) =>
      compareNullableStrings(
        rowA.original.assignee_email ?? null,
        rowB.original.assignee_email ?? null,
      ),
    cell: ({ row }) => {
      const email = row.original.assignee_email
      return (
        <span
          className={
            email ? "text-sm" : "text-sm italic text-muted-foreground"
          }
        >
          {email || "Unassigned"}
        </span>
      )
    },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <IssueRowActions issue={row.original} />
      </div>
    ),
  },
]
