"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { Calendar } from "~/components/ui/calendar";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { calendarEvents } from "~/hooks/calendar";
import { RequireConnection } from "~/components/ui/orion/glitches/RequireConnection";

type ViewMode = "day" | "week" | "month";

function parseEventDate(value: string | null) {
  if (!value) return null;
  const d = parseISO(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function CalendarPage() {
  const [mode, setMode] = useState<ViewMode>("month");
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());

  const range = useMemo(() => {
    if (mode === "day") {
      return { from: startOfDay(anchorDate), to: endOfDay(anchorDate) };
    }
    if (mode === "week") {
      return {
        from: startOfWeek(anchorDate, { weekStartsOn: 1 }),
        to: endOfWeek(anchorDate, { weekStartsOn: 1 }),
      };
    }
    return { from: startOfMonth(anchorDate), to: endOfMonth(anchorDate) };
  }, [mode, anchorDate]);

  const { data, isPending, isError, refetch } = calendarEvents({
    timeMin: range.from.toISOString(),
    timeMax: range.to.toISOString(),
    maxResults: 250,
    orderBy: "startTime",
    singleEvents: true,
  });

  const events = data?.events ?? [];

  const selectedDayEvents = useMemo(
    () =>
      events.filter((e) => {
        const start = parseEventDate(e.start);
        return start ? isSameDay(start, anchorDate) : false;
      }),
    [events, anchorDate],
  );

  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(anchorDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [anchorDate]);

  const eventDays = useMemo(
    () => events.map((e) => parseEventDate(e.start)).filter((d): d is Date => !!d),
    [events],
  );

  function shift(delta: number) {
    if (mode === "day") setAnchorDate((d) => addDays(d, delta));
    else if (mode === "week") setAnchorDate((d) => addDays(d, delta * 7));
    else setAnchorDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }

  return (
    <RequireConnection require="googlecalendar">
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-headline-sm font-bold text-foreground">Calendar</h1>
            <p className="text-body-sm text-muted-foreground">Day / Week / Month views</p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Next">
              <ChevronRight className="size-4" />
            </Button>
            <Button variant="outline" onClick={() => setAnchorDate(new Date())}>
              Today
            </Button>
          </div>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>

          {/* Day */}
          <TabsContent value="day">
            <Card>
              <CardHeader>
                <CardTitle>{format(anchorDate, "EEEE, MMM d")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <EventState isPending={isPending} isError={isError} onRetry={refetch} />
                {!isPending && !isError && (
                  <EventList events={selectedDayEvents} emptyText="No events for this day." />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Week */}
          <TabsContent value="week">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <EventState isPending={isPending} isError={isError} onRetry={refetch} />
              {!isPending &&
                !isError &&
                weekDays.map((day) => {
                  const dayEvents = events.filter((e) => {
                    const start = parseEventDate(e.start);
                    return start ? isSameDay(start, day) : false;
                  });

                  return (
                    <Card key={day.toISOString()}>
                      <CardHeader>
                        <CardTitle className="text-sm">{format(day, "EEE, MMM d")}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <EventList events={dayEvents} emptyText="No events" compact />
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </TabsContent>

          {/* Month */}
          <TabsContent value="month">
            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>{format(anchorDate, "MMMM yyyy")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Calendar
                    mode="single"
                    selected={anchorDate}
                    onSelect={(d) => d && setAnchorDate(d)}
                    month={anchorDate}
                    onMonthChange={setAnchorDate}
                    modifiers={{ hasEvent: eventDays }}
                    modifiersClassNames={{
                      hasEvent:
                        "relative after:absolute after:bottom-1.5 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
                    }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {format(anchorDate, "MMMM d")}{" "}
                    <span className="text-muted-foreground">({format(anchorDate, "EEEE")})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <EventState isPending={isPending} isError={isError} onRetry={refetch} />
                  {!isPending && !isError && (
                    <EventList
                      events={events.filter((e) => {
                        const start = parseEventDate(e.start);
                        return start
                          ? isSameDay(start, anchorDate) && isSameMonth(start, anchorDate)
                          : false;
                      })}
                      emptyText="No events on selected day."
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </RequireConnection>
  );
}

function EventState({
  isPending,
  isError,
  onRetry,
}: {
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground h-full w-full justify-center">
        <CalendarIcon className="size-4" />
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-between rounded-md border border-destructive/40 p-3 text-sm">
        <span className="text-destructive">Failed to load events.</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  return null;
}

function EventList({
  events,
  emptyText,
  compact = false,
}: {
  events: Array<{
    id: string;
    summary: string | null;
    start: string | null;
    end: string | null;
    location: string | null;
  }>;
  emptyText: string;
  compact?: boolean;
}) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2">
      {events.map((e) => {
        const start = parseEventDate(e.start);
        const end = parseEventDate(e.end);
        const time = start
          ? `${format(start, "p")}${end ? ` - ${format(end, "p")}` : ""}`
          : "All day";

        return (
          <li key={e.id} className="rounded-md border p-3">
            <p className={compact ? "text-sm font-medium" : "text-base font-medium"}>
              {e.summary ?? "Untitled event"}
            </p>
            <p className="text-xs text-muted-foreground">{time}</p>
            {e.location ? <p className="text-xs text-muted-foreground">{e.location}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
