import { EB_Garamond } from "next/font/google";
import "./globals.css";

const garamond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-garamond",
});

export const metadata = {
  title: "DocFlow AI — Sovereign Voice-to-Legal Engine",
  description:
    "India-specific agentic legal workspace for SMEs. Create and edit legal documents through AI chat and voice.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${garamond.variable} antialiased`}>{children}</body>
    </html>
  );
}
