"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadAgentPassportPhoto } from "@/lib/agents/actions";
import { Camera, ImagePlus, Trash2, X } from "lucide-react";

type Props = {
  disabled?: boolean;
  name?: string;
  initialUrl?: string | null;
};

export function PassportPhotoField({
  disabled,
  name = "passport_photo_url",
  initialUrl = null,
}: Props) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [pending, startTransition] = useTransition();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  }

  useEffect(() => () => stopCamera(), []);

  async function uploadBlob(blob: Blob, filename: string) {
    const fd = new FormData();
    fd.set("file", new File([blob], filename, { type: blob.type || "image/jpeg" }));
    const result = await uploadAgentPassportPhoto(fd);
    if (result.error || !result.url) {
      toast.error(result.error ?? "Could not upload passport photo");
      return;
    }
    setUrl(result.url);
    toast.success("Passport photo saved");
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    startTransition(async () => {
      await uploadBlob(file, file.name || "passport.jpg");
    });
  }

  async function openCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser cannot use the webcam. Upload an image instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      });
    } catch {
      setCameraError("Camera permission denied or unavailable. Upload an image instead.");
      stopCamera();
    }
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      toast.error("Camera is not ready yet");
      return;
    }
    const size = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 640, 640);
    startTransition(async () => {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
      );
      if (!blob) {
        toast.error("Could not capture photo");
        return;
      }
      await uploadBlob(blob, `passport-${Date.now()}.jpg`);
      stopCamera();
    });
  }

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label>Passport photograph</Label>
      <input type="hidden" name={name} value={url} />
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-36 w-28 items-center justify-center overflow-hidden rounded-md border border-dashed border-input bg-muted/30">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Passport preview" className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-xs text-muted-foreground">No photo yet</span>
          )}
        </div>
        <div className="flex min-w-[12rem] flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || pending}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="mr-2 h-4 w-4" />
              Upload image
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || pending}
              onClick={() => void openCamera()}
            >
              <Camera className="mr-2 h-4 w-4" />
              Use webcam
            </Button>
            {url ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || pending}
                onClick={() => setUrl("")}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            JPEG or PNG. Capture a clear head-and-shoulders passport-style photo.
          </p>
          {cameraError ? <p className="text-xs text-destructive">{cameraError}</p> : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={disabled || pending}
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {cameraOpen ? (
        <div className="space-y-2 rounded-md border border-input bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Webcam capture</p>
            <Button type="button" size="sm" variant="ghost" onClick={stopCamera}>
              <X className="mr-1 h-4 w-4" />
              Close
            </Button>
          </div>
          <video
            ref={videoRef}
            playsInline
            muted
            className="mx-auto aspect-square max-h-72 w-full max-w-xs rounded-md bg-black object-cover"
          />
          <Button type="button" disabled={pending} onClick={captureFrame}>
            {pending ? "Saving…" : "Capture photo"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
