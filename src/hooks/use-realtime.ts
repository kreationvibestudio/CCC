"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function useRealtime<T extends Record<string, unknown>>(
  table: string,
  filter?: { column: string; value: string },
  onEvent?: (payload: { eventType: string; new: T; old: T }) => void
) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const enabled = Boolean(table && (!filter || filter.value));

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    const supabase = createClient();
    const channelName = filter
      ? `rt:${table}:${filter.column}=${filter.value}`
      : `rt:${table}:all`;

    const config: {
      event: "*";
      schema: "public";
      table: string;
      filter?: string;
    } = { event: "*", schema: "public", table };

    if (filter?.value) {
      config.filter = `${filter.column}=eq.${filter.value}`;
    }

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on("postgres_changes", config, (payload) => {
        onEventRef.current?.({
          eventType: payload.eventType,
          new: payload.new as T,
          old: payload.old as T,
        });
      })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      setConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [enabled, table, filter?.column, filter?.value]);

  return { connected };
}

export function useNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      title: string;
      message: string;
      type: string;
      read: boolean;
      link?: string;
      created_at: string;
    }>
  >([]);

  const handleEvent = useCallback(
    (payload: { eventType: string; new: Record<string, unknown> }) => {
      if (payload.eventType === "INSERT") {
        setNotifications((prev) => [payload.new as typeof notifications[0], ...prev]);
      }
    },
    []
  );

  useRealtime(
    "notifications",
    userId ? { column: "user_id", value: userId } : undefined,
    userId ? handleEvent : undefined
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, setNotifications };
}
