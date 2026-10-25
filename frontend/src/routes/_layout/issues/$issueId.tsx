import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, Pencil } from "lucide-react"
import { Suspense, useState } from "react"

import { IssuesService, UsersService } from "@/client"
import CommentSection from "@/components/Issues/CommentSection"
import EditIssue from "@/components/Issues/EditIssue"
import {
  DUE_DATE_URGENCY_CLASS,
  formatDueDate,
  getDueDateUrgency,
  ISSUE_STATUSES,
  priorityLabel,
  STATUS_BADGE_VARIANT,
} from "@/components/Issues/issueDisplay"
import ShareIssueDialog from "@/components/Issues/ShareIssueDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/issues/$issueId")({
  component: IssueDetailPage,
  head: () => ({
    meta: [
      {
        title: "Issue - Easy Tracker",
      },
    ],
  }),
})

function issueQueryOptions(issueId: string) {
  return {
    queryKey: ["issues", issueId],
    queryFn: () => IssuesService.readIssue({ id: issueId }),
  }
}

function AssigneeEditor({ issueId }: { issueId: string }) {
  const [email, setEmail] = useState("")
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: async () => {
      let assignee_id: string | null = null
      if (email) {
        const assignee = await UsersService.lookupUserByEmail({ email })
        assignee_id = assignee.id
      }
      return IssuesService.updateIssue({
        id: issueId,
        requestBody: { assignee_id },
      })
    },
    onSuccess: () => {
      showSuccessToast("Assignee updated")
      setEmail("")
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["issues", issueId] })
      queryClient.invalidateQueries({ queryKey: ["issues"] })
    },
  })

  return (
    <div className="flex flex-wrap gap-2">
      <Input
        placeholder="Assignee email (blank to unassign)"
        type="email"
        className="min-w-0 flex-1"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button
        variant="outline"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        Update
      </Button>
    </div>
  )
}

function IssueDetailContent({ issueId }: { issueId: string }) {
  const { data: issue } = useSuspenseQuery(issueQueryOptions(issueId))
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const statusMutation = useMutation({
    mutationFn: (status: (typeof ISSUE_STATUSES)[number]) =>
      IssuesService.updateIssue({ id: issueId, requestBody: { status } }),
    onSuccess: () => {
      showSuccessToast("Status updated")
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["issues", issueId] })
      queryClient.invalidateQueries({ queryKey: ["issues"] })
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/issues"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back to issues
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{issue.title}</h1>
          <p className="text-sm text-muted-foreground">
            Opened by {issue.owner_email}
            {issue.created_at &&
              ` on ${new Date(issue.created_at).toLocaleDateString()}`}
          </p>
        </div>
        {issue.is_owner && (
          <div className="flex shrink-0 items-center gap-2">
            <EditIssue
              issue={issue}
              onSuccess={() => {}}
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil className="size-4" />
                  Edit
                </Button>
              }
            />
            <ShareIssueDialog issueId={issueId} />
          </div>
        )}
      </div>

      <p className="whitespace-pre-wrap text-sm">
        {issue.description || (
          <span className="italic text-muted-foreground">
            No description
          </span>
        )}
      </p>

      <div className="grid grid-cols-1 gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Status</span>
          {issue.can_edit_status ? (
            <Select
              value={issue.status}
              onValueChange={(value) =>
                statusMutation.mutate(value as (typeof ISSUE_STATUSES)[number])
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant={STATUS_BADGE_VARIANT[issue.status ?? "Open"]}>
              {issue.status}
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Priority</span>
          <span className="text-sm text-muted-foreground">
            {priorityLabel(issue.priority ?? 3)}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Due date</span>
          <span
            className={
              DUE_DATE_URGENCY_CLASS[
                getDueDateUrgency(issue.due_date, issue.status)
              ]
            }
          >
            {formatDueDate(issue.due_date)}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Assignee</span>
          {issue.can_edit_assignee ? (
            <AssigneeEditor issueId={issueId} />
          ) : (
            <span
              className={
                issue.assignee_email
                  ? "text-sm"
                  : "text-sm italic text-muted-foreground"
              }
            >
              {issue.assignee_email || "Unassigned"}
            </span>
          )}
        </div>
      </div>

      <CommentSection issueId={issueId} />
    </div>
  )
}

function IssueDetailPageFallback() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

function IssueDetailPage() {
  const { issueId } = Route.useParams()

  return (
    <Suspense fallback={<IssueDetailPageFallback />}>
      <IssueDetailContent issueId={issueId} />
    </Suspense>
  )
}
