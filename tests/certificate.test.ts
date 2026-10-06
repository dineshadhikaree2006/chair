import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  certificateDate,
  certificateFilename,
  certificateTitle,
  createCertificatePng,
  wrapCertificateText,
  type CertificateData,
} from '../lib/certificate';
import { demos } from '../lib/demos';

const certificate: CertificateData = {
  id: 'CHAIR-12345678',
  issuedAt: new Date(2026, 9, 6, 12, 0).toISOString(),
  objections: 3,
  report: demos[0].report,
  demo: { name: demos[0].name, glyph: demos[0].glyph },
  imageUrl: '',
};

test('certificates retain the original verdict and clearly label demo files', () => {
  assert.equal(certificateTitle('CHAIR'), 'Official Certificate of Chairhood.');
  assert.equal(certificateTitle('NOT A CHAIR'), 'Certificate of Suspicious Non-Chair Status.');
  assert.equal(certificateFilename(certificate), 'DEMO-chair-affairs-CHAIR-12345678.png');
  assert.equal(certificateFilename({ ...certificate, demo: null }), 'chair-affairs-CHAIR-12345678.png');
  assert.equal(certificateDate(certificate.issuedAt), 'October 6, 2026');
});

test('certificate wrapping preserves a 300-character classification within its width', () => {
  const classification = 'An extremely suspicious apparatus for sitting sideways on bureaucracy. '.repeat(5).slice(0, 300).trim();
  const lines = wrapCertificateText(classification, 32, value => Array.from(value).length);
  assert.ok(lines.every(line => line.length <= 32));
  assert.equal(lines.join(' '), classification);
});

test('certificate wrapping handles long unbroken words without cutting text off', () => {
  const classification = '🪑'.repeat(150);
  const lines = wrapCertificateText(classification, 25, value => Array.from(value).length);
  assert.ok(lines.every(line => Array.from(line).length <= 25));
  assert.equal(lines.join(''), classification);
});

test('a reset aborts certificate rendering before creating browser resources', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(createCertificatePng(certificate, controller.signal), { name: 'AbortError' });
});
