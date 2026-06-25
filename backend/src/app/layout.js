export const metadata = {
  title: "easyShop API",
  description: "Next.js API backend for easyShop"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
