import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pazengo — New & used cars for sale",
  description: "Pazengo, Zambia's car marketplace. Buy and sell cars, motorbikes, boats and trucks."
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
