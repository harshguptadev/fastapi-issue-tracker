import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"

import { IssuesService } from "@/client"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface CommentSectionProps {
  issueId: string
}

interface CommentFormData {
  content: string
}

const RELATIVE_TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
]

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
})

function formatTimestamp(value: string | null | undefined) {
  if (!value) return ""

  const date = new Date(value)
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000)

  if (Math.abs(diffSeconds) < 60) {
    return "just now"
  }

  for (const [unit, secondsInUnit] of RELATIVE_TIME_UNITS) {
    if (Math.abs(diffSeconds) >= secondsInUnit) {
      return relativeTimeFormatter.format(
        Math.round(diffSeconds / secondsInUnit),
        unit,
      )
    }
  }

  return date.toLocaleString()
}

const CommentSection = ({ issueId }: CommentSectionProps) => {
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()

  const commentsQuery = useQuery({
    queryKey: ["issues", issueId, "comments"],
    queryFn: () => IssuesService.readComments({ id: issueId }),
  })

  const { register, handleSubmit, reset, formState } =
    useForm<CommentFormData>({
      defaultValues: { content: "" },
    })

  const mutation = useMutation({
    mutationFn: (data: CommentFormData) =>
      IssuesService.createComment({
        id: issueId,
        requestBody: { content: data.content },
      }),
    onSuccess: () => {
      reset()
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["issues", issueId, "comments"],
      })
    },
  })

  const onSubmit = (data: CommentFormData) => {
    if (!data.content.trim()) return
    mutation.mutate(data)
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">Comments</h3>

      {commentsQuery.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {commentsQuery.data?.data.length === 0 && (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {commentsQuery.data?.data.map((comment) => (
          <div key={comment.id} className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {comment.author_email}
              </span>
              <span
                className="text-xs text-muted-foreground"
                title={
                  comment.created_at
                    ? new Date(comment.created_at).toLocaleString()
                    : undefined
                }
              >
                {formatTimestamp(comment.created_at)}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {comment.content}
            </p>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-2 border-t pt-4"
      >
        <Textarea
          placeholder="Add a comment..."
          rows={3}
          {...register("content", { required: true })}
        />
        <LoadingButton
          type="submit"
          className="self-start"
          loading={mutation.isPending || formState.isSubmitting}
        >
          Comment
        </LoadingButton>
      </form>
    </div>
  )
}

export default CommentSection
