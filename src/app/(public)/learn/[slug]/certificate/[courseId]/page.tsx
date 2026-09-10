import { redirect } from "next/navigation";
import { getLearnCertificate } from "@/lib/lms/learn";
import { PrintButton } from "@/components/lms/print-button";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const cert = await getLearnCertificate(courseId);
  if ("error" in cert) redirect(`/learn/${slug}`);
  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" asChild><Link href={`/learn/${slug}`}>Back</Link></Button>
      <div className="rounded-xl border-2 border-emerald-500/40 bg-card p-8 text-center print:border-black">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Certificate of completion</p>
        <h1 className="mt-4 text-3xl font-bold">{cert.campaign}</h1>
        <p className="mt-6 text-sm text-muted-foreground">This certifies that</p>
        <p className="mt-1 text-2xl font-semibold">{cert.volunteer.full_name}</p>
        <p className="mt-4 text-sm text-muted-foreground">has completed</p>
        <p className="mt-1 text-xl font-medium">{cert.course.title}</p>
        <p className="mt-6 text-sm">
          {new Date(cert.cert.issued_at).toLocaleDateString("en-NG", { dateStyle: "long" })}
        </p>
        <p className="mt-2 font-mono text-xs text-muted-foreground">{cert.cert.code}</p>
      </div>
      <PrintButton />
    </div>
  );
}
