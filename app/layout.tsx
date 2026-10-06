import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Is This a Chair? — Bureau of Chair Affairs', description: 'Questionable objects. Unquestionable authority. A comedy furniture inspector.' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
