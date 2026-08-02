"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export function useRealtime<T extends Record<string, unknown>>(
  table: string,
  filter?: { column: string; value: string },
  onEvent?: (payload: { eventType: string; new: T; old: T }) => void
) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let channel = supabase.channel(`${table}-changes`);

    const config: {
      event: "*";
      schema: "public";
      table: string;
      filter?: string;
    } = { event: "*", schema: "public", table };

    if (filter) {
      config.filter = `${filter.column}=eq.${filter.value}`;
    }

    channel = channel.on(
      "postgres_changes",
      config,
      (payload) => {
        onEvent?.({
          eventType: payload.eventType,
          new: payload.new as T,
          old: payload.old as T,
        });
      }
    ).subscribe((status) => {
      setConnected(status === "SUBSCRIBED");
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter?.column, filter?.value, onEvent]);

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
    handleEvent
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, setNotifications };
}
