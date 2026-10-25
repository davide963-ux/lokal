"use client";

// Last resort: replaces the root layout, so it must bring its own <html> and cannot rely on app CSS.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f6f5f1", color: "#1f2528", display: "grid", placeItems: "center", minHeight: "100dvh", textAlign: "center", padding: 16 }}>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#667075", margin: "0 0 16px" }}>Please try again. If the problem continues, tell your manager.</p>
          {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12, color: "#667075" }}>Reference: {error.digest}</p>}
          <button onClick={reset} style={{ background: "#1f6f54", color: "#fff", border: 0, borderRadius: 10, padding: "12px 20px", fontSize: 16, cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
