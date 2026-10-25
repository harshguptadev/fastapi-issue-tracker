import { useQuery } from "@tanstack/react-query"
import { Layers, ShieldAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface OverlapItem {
  candidate_id: string
  candidate_title: string
  candidate_status: string
  candidate_bureau: string
  source_bureau: string
  aicte_pid: string
  cross_bureau: boolean
  confidence_score: number
  match_layer: string
  explanation: string
  owner_email: string
  due_date: string | null
}

interface OverlapResponse {
  issue_id: string
  count: number
  data: OverlapItem[]
}

export default function OverlapAlerts({ issueId }: { issueId: string }) {
  const { data, isLoading } = useQuery<OverlapResponse>({
    queryKey: ["overlaps", issueId],
    queryFn: async () => {
      let token = "";
      try {
        const accounts = JSON.parse(localStorage.getItem("accounts") || "[]");
        const activeId = localStorage.getItem("active_account_id");
        const activeAccount = accounts.find((acc: any) => acc.id === activeId) || accounts[0];
        if (activeAccount && activeAccount.token) {
          token = activeAccount.token;
        }
      } catch (e) {
        console.error("Failed to extract auth token", e);
      }

      const res = await fetch(`http://localhost:8000/api/v1/issues/${issueId}/overlaps`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) throw new Error("Failed to fetch overlap alerts")
      return res.json()
    },
  })

  if (isLoading) {
    return <div className="text-sm text-muted-foreground animate-pulse">Running 3-layer overlap detection engine...</div>
  }

  if (!data || data.count === 0) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-sm text-green-700 dark:text-green-400">
        <span className="font-semibold">Entity Integrity Verified:</span> No cross-bureau conflicts or duplicate actions detected for this institutional record.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold">
        <ShieldAlert className="size-5" />
        <span>Potential Overlapping Cases — Coordination Required ({data.count})</span>
      </div>
      <p className="text-xs text-muted-foreground">
        The AICTE Overlap Engine flagged related active proceedings in other bureaus. Human-in-the-loop review recommended before issuing final notices.
      </p>

      <div className="flex flex-col gap-3 mt-2">
        {data.data.map((item) => (
          <div key={item.candidate_id} className="flex flex-col gap-2 rounded-md border bg-card p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant={item.cross_bureau ? "destructive" : "secondary"}>
                  {item.candidate_bureau} Bureau
                </Badge>
                <span className="text-sm font-medium">{item.candidate_title}</span>
              </div>
              <span className="text-xs font-bold px-2 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                {item.confidence_score}% Match
              </span>
            </div>

            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span><b>PID:</b> {item.aicte_pid}</span>
              <span><b>Status:</b> {item.candidate_status}</span>
              <span><b>Officer:</b> {item.owner_email}</span>
            </div>

            <div className="text-xs bg-muted/60 p-2 rounded flex items-start gap-1.5 font-mono text-foreground/90">
              <Layers className="size-3.5 mt-0.5 shrink-0 text-primary" />
              <span><b>{item.match_layer}:</b> {item.explanation}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}