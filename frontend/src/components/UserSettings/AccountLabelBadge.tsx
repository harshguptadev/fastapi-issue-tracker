import type { ReactNode } from "react"
import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type AccountLabel, LABEL_COLOR_PRESETS } from "@/lib/accounts"
import { cn } from "@/lib/utils"
import { getReadableTextColor } from "@/utils"

export function AccountLabelBadge({
  label,
  className,
}: {
  label: AccountLabel
  className?: string
}) {
  return (
    <Badge
      className={cn("border-transparent", className)}
      style={{
        backgroundColor: label.color,
        color: getReadableTextColor(label.color),
      }}
    >
      {label.text}
    </Badge>
  )
}

export function LabelEditorDialog({
  label,
  onSave,
  trigger,
}: {
  label: AccountLabel
  onSave: (label: AccountLabel) => void
  trigger: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(label.text)
  const [color, setColor] = useState(label.color)

  useEffect(() => {
    if (open) {
      setText(label.text)
      setColor(label.color)
    }
  }, [open, label])

  const handleSave = () => {
    const trimmed = text.trim()
    onSave({ text: trimmed.length > 0 ? trimmed : label.text, color })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit label</DialogTitle>
          <DialogDescription>
            Customize the name and color shown for this account in the switch
            list
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="account-label-text">Label text</Label>
            <Input
              id="account-label-text"
              value={text}
              maxLength={12}
              onChange={(event) => setText(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Preset colors</Label>
            <div className="flex flex-wrap gap-2">
              {LABEL_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.color}
                  type="button"
                  aria-label={preset.text}
                  onClick={() => setColor(preset.color)}
                  className={cn(
                    "size-7 rounded-full border-2 transition-transform",
                    color.toLowerCase() === preset.color.toLowerCase()
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105",
                  )}
                  style={{ backgroundColor: preset.color }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="account-label-color">Custom color</Label>
            <div className="flex items-center gap-2">
              <input
                id="account-label-color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="size-9 cursor-pointer rounded border bg-transparent p-1"
              />
              <span className="text-sm text-muted-foreground">{color}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Preview</span>
            <AccountLabelBadge
              label={{ text: text.trim() || label.text, color }}
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
