import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Compliance Mapping Demo',
  description:
    'A working demo of a Compliance Mapping Agent — wire-tracing regulated data through a payment service codebase.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
