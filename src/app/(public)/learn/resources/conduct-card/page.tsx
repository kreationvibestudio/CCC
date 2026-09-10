import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ConductCardPage() {
  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" asChild>
        <Link href="/learn">Back to training</Link>
      </Button>
      <article className="rounded-xl border bg-card p-6 text-sm leading-relaxed">
        <h1 className="text-xl font-bold">Field conduct card</h1>
        <ul className="mt-4 list-disc space-y-2 pl-5">
          <li>Introduce yourself and the campaign. Accept no as an answer.</li>
          <li>Use approved talking points only. Do not invent policy.</li>
          <li>Never offer money or gifts for a vote.</li>
          <li>Keep voter data in official tools. Do not forward lists.</li>
          <li>Work in pairs. Walk away from confrontation and report it.</li>
          <li>Polling day: observe and report. Do not touch INEC materials.</li>
        </ul>
      </article>
    </div>
  );
}
