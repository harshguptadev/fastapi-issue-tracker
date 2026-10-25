import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useState } from "react"

import type { IssuePublic, IssueStatus } from "@/client"
import { IssuesService } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { IssueActionsMenu } from "./IssueActionsMenu"
import {
  DUE_DATE_URGENCY_CLASS,
  formatDueDate,
  getDueDateUrgency,
  ISSUE_STATUSES,
  priorityBadgeClass,
  priorityLabel,
} from "./issueDisplay"

interface KanbanBoardProps {
  issues: IssuePublic[]
}

function KanbanCard({
  issue,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  issue: IssuePublic
  isDragging: boolean
  onDragStart: (e: React.DragEvent, issue: IssuePublic) => void
  onDragEnd: () => void
}) {
  const { user } = useAuth()
  const isOwner = user?.is_superuser || user?.id === issue.owner_id
  const urgency = getDueDateUrgency(issue.due_date, issue.status)

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, issue)}
      onDragEnd={onDragEnd}
      className={`gap-3 p-3 cursor-grab active:cursor-grabbing transition-opacity ${
        isDragging ? "opacity-40" : "opacity-100"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          to="/issues/$issueId"
          params={{ issueId: issue.id }}
          className="text-sm font-medium hover:underline"
        >
          {issue.title}
        </Link>
        {isOwner && (
          <div className="-mr-2 -mt-1 shrink-0">
            <IssueActionsMenu issue={issue} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={priorityBadgeClass(issue.priority ?? 3)}>
          {priorityLabel(issue.priority ?? 3)}
        </Badge>
        {issue.due_date && (
          <span className={`text-xs ${DUE_DATE_URGENCY_CLASS[urgency]}`}>
            {formatDueDate(issue.due_date)}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground truncate">
        {issue.assignee_email ?? "Unassigned"}
      </p>
    </Card>
  )
}

export function KanbanBoard({ issues }: KanbanBoardProps) {
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<IssueStatus | null>(
    null,
  )

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: IssueStatus }) =>
      IssuesService.updateIssue({ id, requestBody: { status } }),
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] })
    },
  })

  const handleDragStart = (e: React.DragEvent, issue: IssuePublic) => {
    e.dataTransfer.setData("text/plain", issue.id)
    e.dataTransfer.effectAllowed = "move"
    setDraggedId(issue.id)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverStatus(null)
  }

  const handleDrop = (e: React.DragEvent, status: IssueStatus) => {
    e.preventDefault()
    const issueId = e.dataTransfer.getData("text/plain")
    setDragOverStatus(null)
    setDraggedId(null)

    const issue = issues.find((i) => i.id === issueId)
    if (!issue || issue.status === status) return

    mutation.mutate({ id: issueId, status })
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {ISSUE_STATUSES.map((status) => {
        const columnIssues = issues.filter((issue) => issue.status === status)
        const isDragOver = dragOverStatus === status

        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: mouse-only drag-and-drop drop zone; no semantic element (fieldset/list) fits this interaction pattern, and the column's <h3> already labels it
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverStatus(status)
            }}
            onDragLeave={() => setDragOverStatus(null)}
            onDrop={(e) => handleDrop(e, status)}
            className={`flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 min-h-40 transition-colors ${
              isDragOver ? "border-primary bg-primary/5" : ""
            }`}
          >
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold">{status}</h3>
              <Badge variant="outline">{columnIssues.length}</Badge>
            </div>
            <div className="flex flex-col gap-2">
              {columnIssues.map((issue) => (
                <KanbanCard
                  key={issue.id}
                  issue={issue}
                  isDragging={draggedId === issue.id}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))}
              {columnIssues.length === 0 && (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                  No issues
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default KanbanBoard
