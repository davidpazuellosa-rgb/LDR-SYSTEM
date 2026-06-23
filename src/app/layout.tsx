import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SASI LDR Hub",
  description: "Central de saneamento e operação das bases comerciais da SASI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-100 text-slate-800">
        {children}
      </body>
    </html>
  );
}
