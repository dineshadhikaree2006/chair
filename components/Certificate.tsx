'use client';

import { useEffect, useState } from 'react';
import {
  certificateDate,
  certificateFilename,
  certificateTitle,
  createCertificatePng,
  type CertificateData,
} from '@/lib/certificate';

export function Certificate({ certificate, finalizing = false }: { certificate: CertificateData; finalizing?: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<{ certificate: CertificateData; url: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setPreview(null);
    setError('');
    createCertificatePng(certificate, controller.signal)
      .then(blob => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setPreview({ certificate, url: objectUrl });
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setError(failure instanceof Error ? failure.message : 'The certificate could not be generated. Please try again.');
        }
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [certificate, attempt]);

  const previewUrl = preview?.certificate === certificate ? preview.url : null;

  return (
    <section className="certificate-card" aria-labelledby="certificate-title" data-certificate-id={certificate.id}>
      <div className="certificate-heading">
        <p className="eyebrow">Bureau of Chair Affairs. {certificate.demo && <strong> · DEMO</strong>}</p>
        <h3 id="certificate-title">{certificateTitle(certificate.report.verdict)}</h3>
      </div>
      <div className="certificate-meta">
        <p><strong>{certificate.report.classification}</strong></p>
        <p>The holder initially resisted the findings.</p>
        <p>Certified after {certificate.objections} objections</p>
        <p><time dateTime={certificate.issuedAt}>{certificateDate(certificate.issuedAt)}</time> · ID: <span>{certificate.id}</span></p>
        {certificate.demo && <p>DEMO — scripted sample: {certificate.demo.name}. No uploaded photo.</p>}
      </div>
      {previewUrl ? (
        // The original uploaded photo is already encoded into this local PNG.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="certificate-preview" src={previewUrl} width={2400} height={1800} alt={`${certificate.demo ? 'DEMO ' : ''}certificate preview, including ${certificate.demo ? `the ${certificate.demo.name} scripted sample` : 'your uploaded photo'} and the certification details above.`} />
      ) : error ? (
        <div className="certificate-error" role="alert">
          <p>{error}</p>
          <button className="secondary" type="button" onClick={() => setAttempt(value => value + 1)}>Retry certificate</button>
        </div>
      ) : (
        <p className="certificate-loading" role="status">Preparing your certificate…</p>
      )}
      <div className="certificate-actions">
        {finalizing && <p role="status">Finishing the pending message before confirming your objection count…</p>}
        {previewUrl && !finalizing ? (
          <a className="primary" href={previewUrl} download={certificateFilename(certificate)}>Download certificate <span aria-hidden="true">↓</span></a>
        ) : (
          <button className="primary" type="button" disabled>Download certificate <span aria-hidden="true">↓</span></button>
        )}
        <p>High-resolution PNG · 2400 × 1800 · Generated on your device</p>
      </div>
    </section>
  );
}
