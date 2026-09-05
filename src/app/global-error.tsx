"use client";

/**
 * Last resort: this replaces the root layout, so globals.css is not loaded and
 * Tailwind classes would not resolve. Styles are inline on purpose.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0b0f",
          color: "#e7e7ea",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem" }}>
            Campaign Command Center could not start
          </h1>
          <p style={{ margin: "0 0 1.25rem", color: "#a1a1aa", lineHeight: 1.5 }}>
            The application hit an unexpected error before it could render. Reload to try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "0.375rem",
              border: "1px solid #3f3f46",
              background: "#e7e7ea",
              color: "#0b0b0f",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          {error.digest ? (
            <p style={{ marginTop: "1.25rem", fontSize: "0.75rem", color: "#71717a" }}>
              Reference: <code>{error.digest}</code>
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
