import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/forms/submit-button";
import { getVolunteer, getVolunteerTasks, updateVolunteer, deleteVolunteer, assignVolunteerTask } from "@/lib/volunteers/actions";

export default async function VolunteerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const volunteer = await getVolunteer(id);
  if (!volunteer) redirect("/volunteers");
  const tasks = await getVolunteerTasks(id);

  async function saveAction(formData: FormData) {
    "use server";
    const r = await updateVolunteer(id, formData);
    if (r.error) throw new Error(r.error);
    redirect(`/volunteers/${id}`);
  }

  async function deleteAction() {
    "use server";
    await deleteVolunteer(id);
    redirect("/volunteers");
  }

  async function taskAction(formData: FormData) {
    "use server";
    await assignVolunteerTask(id, formData);
    redirect(`/volunteers/${id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={volunteer.full_name} description={volunteer.phone}>
        <Button variant="outline" asChild><Link href="/volunteers">Back</Link></Button>
      </PageHeader>
      <Card><CardContent className="pt-6">
        <form action={saveAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1"><Label>Full name</Label><Input name="full_name" defaultValue={volunteer.full_name} required /></div>
            <div className="space-y-1"><Label>Phone</Label><Input name="phone" defaultValue={volunteer.phone} required /></div>
            <div className="space-y-1"><Label>Email</Label><Input name="email" defaultValue={volunteer.email ?? ""} /></div>
            <div className="space-y-1"><Label>Ward</Label><Input name="ward" defaultValue={volunteer.ward ?? ""} /></div>
            <div className="space-y-1"><Label>LGA</Label><Input name="lga" defaultValue={volunteer.lga ?? ""} /></div>
            <div className="space-y-1"><Label>Skills (comma-separated)</Label><Input name="skills" defaultValue={volunteer.skills?.join(", ") ?? ""} /></div>
          </div>
          <select name="training_status" defaultValue={volunteer.training_status} className="flex h-9 w-full rounded-md border border-input px-3 text-sm">
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
          <SubmitButton label="Save" />
        </form>
      </CardContent></Card>
      <Card><CardContent className="pt-6">
        <h2 className="mb-3 font-semibold">Tasks ({tasks.length})</h2>
        {tasks.map((t) => (
          <div key={t.id} className="mb-2 flex justify-between border-b pb-2 text-sm">
            <span>{t.title}</span>
            <Badge variant="secondary">{t.status}</Badge>
          </div>
        ))}
        <form action={taskAction} className="mt-4 space-y-2">
          <Input name="title" placeholder="New task title" required />
          <Input name="description" placeholder="Description" />
          <Button type="submit" size="sm">Assign task</Button>
        </form>
      </CardContent></Card>
      <form action={deleteAction}><Button type="submit" variant="destructive" size="sm">Delete volunteer</Button></form>
    </div>
  );
}
