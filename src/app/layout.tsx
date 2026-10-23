import type { Metadata } from "next";
import "./globals.css";
import "./tema-escuro.generated.css";

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
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo ANTES de pintar a tela (evita o "flash" de tela clara no escuro). */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("tema")==="escuro")document.documentElement.classList.add("dark")}catch(e){}` }} />
      </head>
      <body className="min-h-full flex flex-col bg-page text-slate-800">
        {children}
      </body>
    </html>
  );
}
