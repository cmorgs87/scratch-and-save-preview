import type { Metadata } from "next";
import "./globals.css";
import AuthGate from "./_components/AuthGate";

export const metadata: Metadata = {
  title: "Scratch & Save",
  description: "Scratch & Save ticket experience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
              try {
                const stored = localStorage.getItem("scratch-save-theme");
                const theme = stored === "light" || stored === "dark"
                  ? stored
                  : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
                document.documentElement.dataset.theme = theme;
              } catch {}
            })();`,
          }}
        />
      </head>
      <body>
        <AuthGate />
        {children}
      </body>
    </html>
  );
}
