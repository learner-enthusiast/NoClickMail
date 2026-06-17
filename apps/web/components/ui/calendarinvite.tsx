import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Label } from "./label";
import { Input } from "./input";
import { Button } from "./button";

function toRFC3339(datetimeLocal: string) {
  return new Date(datetimeLocal).toISOString();
}

function CalendarInviteDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: {
    summary: string;
    description?: string;
    location?: string;
    start: string;
    end: string;
    attendees?: string[];
  }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [attendees, setAttendees] = useState("");

  function reset() {
    setSummary("");
    setDescription("");
    setLocation("");
    setStart("");
    setEnd("");
    setAttendees("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!summary.trim() || !start || !end) return;

    const attendeeList = attendees
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    await onSubmit({
      summary: summary.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      start: toRFC3339(start),
      end: toRFC3339(end),
      attendees: attendeeList.length > 0 ? attendeeList : undefined,
    });

    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create calendar invite</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-title">Title</Label>
            <Input
              id="invite-title"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Team sync"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="invite-start">Start</Label>
              <Input
                id="invite-start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-end">End</Label>
              <Input
                id="invite-end"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-location">Location</Label>
            <Input
              id="invite-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Zoom / Office"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-attendees">Attendees</Label>
            <Input
              id="invite-attendees"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="alice@example.com, bob@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-description">Description</Label>
            <textarea
              id="invite-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Agenda, notes…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !summary.trim() || !start || !end}>
              {isSubmitting ? "Creating…" : "Create invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CalendarInviteDialog;
