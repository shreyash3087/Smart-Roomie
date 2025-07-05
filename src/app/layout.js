import Header from "@/components/Header";
import { UserProvider } from "../../utils/context";
import "./globals.css";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Smart Roomie",
  description: "Smart Roomie - Find your Best Roomate",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <UserProvider>
          <Header />
          {children}
          <Footer />
        </UserProvider>
      </body>
    </html>
  );
}
