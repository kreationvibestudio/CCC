export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.45_0.15_255/0.08),transparent_50%)]" />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
