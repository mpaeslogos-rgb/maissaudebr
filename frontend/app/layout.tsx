// app/layout.tsx
// Root layout — envolve toda a aplicação com o AuthProvider
// Por quê aqui? É o único lugar que garante que o contexto
// de autenticação esteja disponível em TODAS as páginas.

import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "MaisSaúdeBR — Gestão de Clínica",
  description: "Plataforma completa de gestão para clínicas médicas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* AuthProvider aqui garante que useAuth() funciona
            em qualquer página, incluindo /dashboard e seus filhos */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}