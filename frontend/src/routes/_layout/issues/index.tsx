import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { LayoutGrid, List, Search } from "lucide-react"
import { Suspense } from "react"
import { z } from "zod"

import { IssuesService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import AddIssue from "@/components/Issues/AddIssue"
import { columns } from "@/components/Issues/columns"
import { ISSUE_STATUSES, priorityLabel } from "@/components/Issues/issueDisplay"
import KanbanBoard from "@/components/Issues/KanbanBoard"
import PendingIssues from "@/components/Pending/PendingIssues"
import PendingKanban from "@/components/Pending/PendingKanban"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useAuth from "@/hooks/useAuth"

const ALL_VALUE = "all"

const searchSchema = z.object({
  status: z.enum(["Open", "In Progress", "Done"]).optional().catch(undefined),
  priority: z.coerce.number().int().min(1).max(5).optional().catch(undefined),
  assignedToMe: z.boolean().optional().catch(undefined),
  view: z.enum(["list", "board"]).optional().catch(undefined),
})

type IssuesSearch = z.infer<typeof searchSchema>

export const Route = createFileRoute("/_layout/issues/")({
  component: Issues,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      {
        title: "Issues - Easy Tracker",
      },
    ],
  }),
})

function getIssuesQueryOptions(search: IssuesSearch, assigneeId?: string) {
  return {
    queryFn: () =>
      IssuesService.readIssues({
        skip: 0,
        limit: 100,
        status: search.view === "board" ? undefined : search.status,
        priority: search.priority,
        assigneeId: search.assignedToMe ? assigneeId : undefined,
      }),
    queryKey: ["issues", search, search.assignedToMe ? assigneeId : undefined],
  }
}

function ViewToggle({ search }: { search: IssuesSearch }) {
  const navigate = useNavigate({ from: Route.fullPath })
  const view = search.view ?? "list"

  return (
    <div className="flex items-center gap-1 rounded-md border p-1">
      <Button
        variant={view === "list" ? "secondary" : "ghost"}
        size="sm"
        aria-pressed={view === "list"}
        onClick={() =>
          navigate({
            search: (prev: IssuesSearch) => ({ ...prev, view: "list" }),
          })
        }
      >
        <List className="size-4" />
        List
      </Button>
      <Button
        variant={view === "board" ? "secondary" : "ghost"}
        size="sm"
        aria-pressed={view === "board"}
        onClick={() =>
          navigate({
            search: (prev: IssuesSearch) => ({ ...prev, view: "board" }),
          })
        }
      >
        <LayoutGrid className="size-4" />
        Board
      </Button>
    </div>
  )
}

function IssueFilters({ search }: { search: IssuesSearch }) {
  const navigate = useNavigate({ from: Route.fullPath })
  const isBoardView = search.view === "board"

  return (
    <div className="flex flex-wrap items-center gap-3">
      {!isBoardView && (
        <Select
          value={search.status ?? ALL_VALUE}
          onValueChange={(value) =>
            navigate({
              search: (prev: IssuesSearch) => ({
                ...prev,
                status: value === ALL_VALUE ? undefined : (value as IssuesSearch["status"]),
              }),
            })
          }
        >
          <SelectTrigger className="w-[160px]" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
            {ISSUE_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select
        value={search.priority ? String(search.priority) : ALL_VALUE}
        onValueChange={(value) =>
          navigate({
            search: (prev: IssuesSearch) => ({
              ...prev,
              priority: value === ALL_VALUE ? undefined : Number(value),
            }),
          })
        }
      >
        <SelectTrigger className="w-[180px]" aria-label="Filter by priority">
          <SelectValue placeholder="All priorities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All priorities</SelectItem>
          {[1, 2, 3, 4, 5].map((priority) => (
            <SelectItem key={priority} value={String(priority)}>
              {priorityLabel(priority)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant={search.assignedToMe ? "default" : "outline"}
        onClick={() =>
          navigate({
            search: (prev: IssuesSearch) => ({
              ...prev,
              assignedToMe: !prev.assignedToMe || undefined,
            }),
          })
        }
      >
        Assigned to me
      </Button>
    </div>
  )
}

function IssuesViewContent({ search }: { search: IssuesSearch }) {
  const { user } = useAuth()
  const { data: issues } = useSuspenseQuery(
    getIssuesQueryOptions(search, user?.id),
  )

  if (issues.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">
          You don't have any issues yet
        </h3>
        <p className="text-muted-foreground">
          Add a new issue to get started
        </p>
      </div>
    )
  }

  if (search.view === "board") {
    return <KanbanBoard issues={issues.data} />
  }

  return <DataTable columns={columns} data={issues.data} />
}

function IssuesView({ search }: { search: IssuesSearch }) {
  const fallback = search.view === "board" ? <PendingKanban /> : <PendingIssues />

  return (
    <Suspense fallback={fallback}>
      <IssuesViewContent search={search} />
    </Suspense>
  )
}

function Issues() {
  const search = Route.useSearch()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Issues</h1>
          <p className="text-muted-foreground">
            Create and manage your issues
          </p>
        </div>
        <AddIssue />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <IssueFilters search={search} />
        <ViewToggle search={search} />
      </div>
      <IssuesView search={search} />
    </div>
  )
}
