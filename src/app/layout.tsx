import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExPost AI",
  description: "Criação, edição e publicação automática de vídeos em redes sociais.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
