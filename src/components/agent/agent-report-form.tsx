"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { submitAgentReport } from "@/lib/agent/actions";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";

type PendingMedia = {
  file: File;
  previewUrl: string;
  mediaType: "photo" | "video";
};

export function AgentReportForm({
  puId,
  online,
  disabled,
  onOffline,
}: {
  puId: string;
  online: boolean;
  disabled: boolean;
  onOffline: (data: Record<string, string>) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [attachments, setAttachments] = useState<PendingMedia[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFilesSelected(files: FileList | null) {
    if (!files?.length) return;
    const next: PendingMedia[] = [];
    for (const file of Array.from(files).slice(0, 3 - attachments.length)) {
      const mediaType = file.type.startsWith("video/") ? "video" : "photo";
      next.push({
        file,
        previewUrl: URL.createObjectURL(file),
        mediaType,
      });
    }
    setAttachments((prev) => [...prev, ...next].slice(0, 3));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function uploadFiles(): Promise<Array<{ url: string; media_type: "photo" | "video" }>> {
    const uploaded: Array<{ url: string; media_type: "photo" | "video" }> = [];
    for (const item of attachments) {
      const form = new FormData();
      form.set("file", item.file);
      form.set("kind", "report");
      const res = await fetch("/api/agent/media", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as {
        url?: string;
        media_type?: "photo" | "video";
        error?: string;
      };
      if (!res.ok || json.error || !json.url) {
        throw new Error(json.error || "Could not upload media");
      }
      uploaded.push({ url: json.url, media_type: json.media_type ?? item.mediaType });
    }
    return uploaded;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("polling_unit_id", puId);
    fd.set("captured_at", new Date().toISOString());

    if (!online) {
      const data: Record<string, string> = {};
      fd.forEach((v, k) => {
        data[k] = String(v);
      });
      onOffline(data);
      toast.info("Saved offline — media uploads need a connection; text saved for sync.");
      form.reset();
      setAttachments([]);
      return;
    }

    startTransition(async () => {
      try {
        if (attachments.length) {
          const media_items = await uploadFiles();
          fd.set("media_items", JSON.stringify(media_items));
        }
        const result = await submitAgentReport(fd);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(`Submitted · ${formatDateTime(fd.get("captured_at") as string)}`);
        form.reset();
        setAttachments([]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-border p-4">
      <p className="font-medium">Field report</p>
      <NativeSelect name="report_type">
        <option value="turnout">Turnout update</option>
        <option value="logistics">Logistics</option>
        <option value="observation">Observation</option>
      </NativeSelect>
      <textarea
        name="content"
        required
        rows={3}
        className="flex w-full rounded-md border border-input px-3 py-2 text-sm"
        placeholder="Report details…"
      />
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Attach a photo or video to corroborate this report (optional, up to 3 files).
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
          onChange={(e) => onFilesSelected(e.target.files)}
          disabled={attachments.length >= 3 || pending}
        />
        {attachments.length ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {attachments.map((item, index) => (
              <li key={item.previewUrl} className="flex items-center justify-between gap-2">
                <span>
                  {item.mediaType === "video" ? "Video" : "Photo"}: {item.file.name}
                </span>
                <button
                  type="button"
                  className="text-destructive underline"
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">Date and time are recorded automatically when you tap submit.</p>
      <Button type="submit" disabled={disabled || pending || !puId} className="w-full">
        {pending ? "Uploading…" : "Submit report"}
      </Button>
    </form>
  );
}
