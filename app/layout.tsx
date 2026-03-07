import "./globals.css";
import HealthIndicator from "../components/HealthIndicator";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <HealthIndicator />
        {children}
      </body>
    </html>
  );
}