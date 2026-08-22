"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, FieldHint } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { api, ClientApiError } from "@/lib/client/api";

interface Department {
  id: string;
  name: string;
}

interface ProfileEditFormProps {
  employeeId: string;
  canEditHrFields: boolean;
  departments: Department[];
  initial: {
    fullName: string;
    phone: string | null;
    address: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    profilePhotoUrl: string | null;
    departmentId: string | null;
    jobTitle: string | null;
    employmentStatus: "ACTIVE" | "INACTIVE";
    dateOfJoining: string | null;
  };
}

export function ProfileEditForm({ employeeId, canEditHrFields, departments, initial }: ProfileEditFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSuccess(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const payload: Record<string, unknown> = {
        phone: form.phone || null,
        address: form.address || null,
        emergencyContactName: form.emergencyContactName || null,
        emergencyContactPhone: form.emergencyContactPhone || null,
        profilePhotoUrl: form.profilePhotoUrl || null,
      };
      if (canEditHrFields) {
        Object.assign(payload, {
          fullName: form.fullName,
          departmentId: form.departmentId || null,
          jobTitle: form.jobTitle || null,
          employmentStatus: form.employmentStatus,
          dateOfJoining: form.dateOfJoining || null,
        });
      }
      await api.patch(`/api/employees/${employeeId}`, payload);
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && <Alert tone="danger">{error}</Alert>}
      {success && <Alert tone="success">Profile updated.</Alert>}

      {canEditHrFields && (
        <div className="rounded-[var(--df-radius-md)] border border-[var(--df-accent)]/25 bg-[var(--df-accent-soft)] p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--df-accent)]">HR-managed fields</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="jobTitle">Job title</Label>
              <Input id="jobTitle" value={form.jobTitle ?? ""} onChange={(e) => set("jobTitle", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="department">Department</Label>
              <Select id="department" value={form.departmentId ?? ""} onChange={(e) => set("departmentId", e.target.value || null)}>
                <option value="">No department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="employmentStatus">Employment status</Label>
              <Select id="employmentStatus" value={form.employmentStatus} onChange={(e) => set("employmentStatus", e.target.value as "ACTIVE" | "INACTIVE")}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="dateOfJoining">Date of joining</Label>
              <Input id="dateOfJoining" type="date" value={form.dateOfJoining ?? ""} onChange={(e) => set("dateOfJoining", e.target.value)} />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" />
        </div>
        <div>
          <Label htmlFor="profilePhotoUrl">Profile photo URL</Label>
          <Input id="profilePhotoUrl" value={form.profilePhotoUrl ?? ""} onChange={(e) => set("profilePhotoUrl", e.target.value)} placeholder="https://…" />
          <FieldHint>Paste a link to an image. File upload isn&apos;t wired up for photos in this build.</FieldHint>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="address">Address</Label>
          <Input id="address" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder="Street, city, state" />
        </div>
        <div>
          <Label htmlFor="emergencyContactName">Emergency contact name</Label>
          <Input id="emergencyContactName" value={form.emergencyContactName ?? ""} onChange={(e) => set("emergencyContactName", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="emergencyContactPhone">Emergency contact phone</Label>
          <Input id="emergencyContactPhone" value={form.emergencyContactPhone ?? ""} onChange={(e) => set("emergencyContactPhone", e.target.value)} />
        </div>
      </div>

      <Button type="submit" loading={loading}>
        <Save className="size-4" /> Save changes
      </Button>
    </form>
  );
}
