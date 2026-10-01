"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  CUSTOM_EVENT_TYPE_VALUE,
  EVENT_TYPE_OPTIONS,
} from "@/lib/events/event-types";

export function EventTypeFields({
  defaultValue = "town_hall",
}: {
  defaultValue?: string;
}) {
  const known = EVENT_TYPE_OPTIONS.some((o) => o.value === defaultValue);
  const [mode, setMode] = useState<string>(known ? defaultValue : CUSTOM_EVENT_TYPE_VALUE);
  const [custom, setCustom] = useState(known ? "" : defaultValue);

  const selectValue = mode;
  const isCustom = selectValue === CUSTOM_EVENT_TYPE_VALUE;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="event_type_select">Event type</Label>
        <NativeSelect
          id="event_type_select"
          value={selectValue}
          onChange={(e) => setMode(e.target.value)}
        >
          {EVENT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
          <option value={CUSTOM_EVENT_TYPE_VALUE}>Other (type your own)</option>
        </NativeSelect>
      </div>

      {isCustom ? (
        <div className="space-y-1">
          <Label htmlFor="event_type_custom">Custom event type</Label>
          <Input
            id="event_type_custom"
            name="event_type"
            required
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="e.g. Women leaders forum"
          />
        </div>
      ) : (
        <input type="hidden" name="event_type" value={selectValue} />
      )}
    </div>
  );
}
