import type { Metadata } from "next";
import { Lato } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-lato",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bloom Beauty Vision",
  description: "Future Simplesat - high fidelity prototype, seeded as Bloom Beauty",
};

// Runs before hydration to apply the .dark class on <html>, avoiding a flash
// of the wrong theme. Mirrors what next-themes does internally.
const themeInitScript = `(function(){try{var t=localStorage.getItem("simplesat:theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}if(t==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${lato.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-background text-foreground text-base">
        <ThemeProvider>
          <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
