import type { Report } from './report';

export type CertificateData = {
  id: string;
  issuedAt: string;
  objections: number;
  report: Report;
  demo: { name: string; glyph: string } | null;
  imageUrl: string;
};

export const CERTIFICATE_WIDTH = 2400;
export const CERTIFICATE_HEIGHT = 1800;

export function certificateTitle(verdict: Report['verdict']) {
  return verdict === 'CHAIR'
    ? 'Official Certificate of Chairhood.'
    : 'Certificate of Suspicious Non-Chair Status.';
}

export function certificateDate(issuedAt: string) {
  return new Date(issuedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export function certificateFilename(certificate: CertificateData) {
  return `${certificate.demo ? 'DEMO-' : ''}chair-affairs-${certificate.id.replace(/[^a-zA-Z0-9_-]/g, '-')}.png`;
}

/** Wrap even a single long classification word without clipping any text. */
export function wrapCertificateText(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    for (const character of Array.from(word)) {
      if (line && measure(line + character) > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line += character;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

function checkCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Certificate rendering cancelled.', 'AbortError');
}

function loadPhoto(source: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    checkCancelled(signal);
    const photo = new Image();
    const clean = () => {
      photo.onload = null;
      photo.onerror = null;
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => {
      clean();
      photo.src = '';
      reject(new DOMException('Certificate rendering cancelled.', 'AbortError'));
    };
    photo.onload = () => {
      clean();
      if (!photo.naturalWidth || !photo.naturalHeight) {
        reject(new Error('The uploaded photo could not be decoded. Try generating the certificate again.'));
      } else {
        resolve(photo);
      }
    };
    photo.onerror = () => {
      clean();
      reject(new Error('The uploaded photo could not be loaded. Try generating the certificate again.'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    photo.src = source;
  });
}

function fittedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  startingSize: number,
  weight = '700',
) {
  let size = startingSize;
  let lines: string[] = [];
  do {
    context.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
    lines = wrapCertificateText(text, width, value => context.measureText(value).width);
    if (lines.length * size * 1.22 <= height || size <= 18) break;
    size -= 2;
  } while (size > 0);
  lines.forEach((line, index) => context.fillText(line, x, y + index * size * 1.22));
}

/** All rendering and PNG encoding stay in this browser, including the uploaded photo. */
export async function createCertificatePng(certificate: CertificateData, signal?: AbortSignal): Promise<Blob> {
  checkCancelled(signal);
  const photo = certificate.demo ? null : await loadPhoto(certificate.imageUrl, signal);
  checkCancelled(signal);

  const canvas = document.createElement('canvas');
  canvas.width = CERTIFICATE_WIDTH;
  canvas.height = CERTIFICATE_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not create the certificate image. Please try again.');

  const ink = '#202019';
  const yellow = '#f5ed31';
  context.fillStyle = '#f5f4ee';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = ink;
  context.lineWidth = 8;
  context.strokeRect(54, 54, 2292, 1692);
  context.lineWidth = 2;
  context.strokeRect(76, 76, 2248, 1648);
  context.textBaseline = 'top';

  context.fillStyle = yellow;
  context.fillRect(78, 78, 2244, 116);
  context.fillStyle = ink;
  context.font = '700 34px "Courier New", monospace';
  context.fillText('Bureau of Chair Affairs.', 134, 118);
  context.textAlign = 'right';
  context.font = '700 27px "Courier New", monospace';
  context.fillText(certificate.demo ? 'DEMO / SCRIPTED SAMPLE' : 'DEPARTMENT OF FINAL FINDINGS', 2264, 122);
  context.textAlign = 'left';

  fittedText(context, certificateTitle(certificate.report.verdict), 134, 248, 2120, 238, 96);
  context.font = '28px "Courier New", monospace';
  context.fillText('THE EVIDENCE HAS BEEN ACCEPTED. THE PAPERWORK IS FOREVER.', 138, 488);
  context.beginPath();
  context.moveTo(134, 548);
  context.lineTo(2266, 548);
  context.stroke();

  const photoBox = { x: 134, y: 590, width: 890, height: 742 };
  context.fillStyle = '#e9e9df';
  context.fillRect(photoBox.x, photoBox.y, photoBox.width, photoBox.height);
  if (photo) {
    const scale = Math.min((photoBox.width - 36) / photo.naturalWidth, (photoBox.height - 36) / photo.naturalHeight);
    const width = photo.naturalWidth * scale;
    const height = photo.naturalHeight * scale;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(photo, photoBox.x + (photoBox.width - width) / 2, photoBox.y + (photoBox.height - height) / 2, width, height);
  } else if (certificate.demo) {
    context.fillStyle = yellow;
    context.fillRect(photoBox.x + 32, photoBox.y + 30, photoBox.width - 64, 68);
    context.fillStyle = ink;
    context.textAlign = 'center';
    context.font = '700 36px "Courier New", monospace';
    context.fillText('DEMO — SCRIPTED SAMPLE', photoBox.x + photoBox.width / 2, photoBox.y + 46);
    context.font = '230px Arial, sans-serif';
    context.fillText(certificate.demo.glyph, photoBox.x + photoBox.width / 2, photoBox.y + 176);
    context.textAlign = 'left';
    fittedText(context, certificate.demo.name, photoBox.x + 54, photoBox.y + 460, photoBox.width - 108, 130, 54);
    context.font = '27px "Courier New", monospace';
    context.fillText('No uploaded photo / Sample findings', photoBox.x + 54, photoBox.y + 652);
  }
  context.strokeRect(photoBox.x, photoBox.y, photoBox.width, photoBox.height);
  context.fillStyle = ink;
  context.font = '25px "Courier New", monospace';
  context.fillText(certificate.demo ? 'EXHIBIT A / DEMONSTRATION ONLY' : 'EXHIBIT A / ORIGINAL UPLOADED PHOTO', photoBox.x, 1354);

  context.fillStyle = yellow;
  context.fillRect(1092, 590, 1174, 74);
  context.fillStyle = ink;
  context.font = '700 32px "Courier New", monospace';
  context.fillText(`FINAL VERDICT: ${certificate.report.verdict}`, 1114, 612);
  context.font = '27px "Courier New", monospace';
  context.fillText('ORIGINAL BUREAU CLASSIFICATION', 1092, 711);
  fittedText(context, certificate.report.classification, 1092, 772, 1140, 570, 62);

  context.beginPath();
  context.moveTo(134, 1412);
  context.lineTo(2266, 1412);
  context.stroke();
  context.font = '36px Arial, Helvetica, sans-serif';
  context.fillText('The holder initially resisted the findings.', 134, 1458);
  context.font = '700 56px Arial, Helvetica, sans-serif';
  context.fillText(`Certified after ${certificate.objections} objections`, 134, 1530);

  context.font = '700 26px "Courier New", monospace';
  context.fillText(`ISSUED ${certificateDate(certificate.issuedAt).toUpperCase()}`, 134, 1655);
  context.textAlign = 'right';
  context.font = '25px "Courier New", monospace';
  context.fillText(`CERTIFICATE ID: ${certificate.id}`, 2266, 1655);
  context.textAlign = 'left';
  checkCancelled(signal);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('The PNG could not be generated. Please try again.')), 'image/png');
  });
  checkCancelled(signal);
  return blob;
}
