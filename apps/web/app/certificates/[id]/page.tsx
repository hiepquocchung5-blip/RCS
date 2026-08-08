"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { MilestoneCertificate } from "@rcs/shared";
import { verifyMilestoneCertificate } from "@/lib/api";

export default function CertificateVerificationPage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<{ valid: boolean; certificate: MilestoneCertificate } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    verifyMilestoneCertificate(id)
      .then((response) => { if (active) setResult(response); })
      .catch(() => { if (active) setError("This certificate could not be verified."); });
    return () => { active = false; };
  }, [id]);

  return (
    <div className="mx-auto flex min-h-full max-w-3xl items-center px-6 py-12">
      <article className="w-full rounded-3xl border border-rise-border bg-rise-surface p-6 shadow-2xl sm:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-rise-gold">RCS delivery verification</p>
        <h1 className="font-display mt-3 text-3xl sm:text-4xl">Milestone certificate</h1>
        {!result && !error && <p className="mt-6 text-rise-muted">Verifying the server signature…</p>}
        {error && <div className="mt-6 rounded-xl border border-rise-error/40 bg-rise-error/10 p-4 text-rise-error">{error}</div>}
        {result && (
          <div className="mt-7 space-y-6">
            <div className={`rounded-xl border p-4 ${result.valid ? "border-rise-success/40 bg-rise-success/10" : "border-rise-error/40 bg-rise-error/10"}`}>
              <p className={result.valid ? "text-rise-success" : "text-rise-error"}>{result.valid ? "✓ Valid server signature" : "Signature validation failed"}</p>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Project" value={result.certificate.projectName} />
              <Field label="Milestone" value={result.certificate.milestoneTitle} />
              <Field label="Client" value={result.certificate.clientName || "RiseCore client"} />
              <Field label="Authorized by" value={result.certificate.signedOffByName} />
              <Field label="Signed at" value={new Date(result.certificate.signedAt).toLocaleString()} />
              <Field label="Verification ID" value={result.certificate.verificationId} mono />
            </dl>
            <div>
              <p className="text-xs uppercase tracking-wide text-rise-muted">HMAC-SHA-256 signature</p>
              <p className="mt-2 break-all rounded-xl bg-rise-bg p-4 font-mono text-xs text-rise-accent">{result.certificate.signature}</p>
            </div>
          </div>
        )}
        <Link href="/" className="mt-8 inline-block text-sm text-rise-accent hover:underline">Return to RiseCoreStudio →</Link>
      </article>
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><dt className="text-xs uppercase tracking-wide text-rise-muted">{label}</dt><dd className={`mt-1 break-words text-sm ${mono ? "font-mono" : "font-medium"}`}>{value}</dd></div>;
}
