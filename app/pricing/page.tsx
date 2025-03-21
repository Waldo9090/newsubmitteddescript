import Header from "../components/Header"
import Footer from "../components/Footer"
import PricingContent from "./components/PricingContent"
import PricingFAQ from "./components/PricingFAQ"

export const metadata = {
  title: "Pricing - Descript AI",
  description: "Choose the perfect plan for your team's needs",
}

export default function PricingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow pt-20">
        <PricingContent />
        <PricingFAQ />
      </main>
      <Footer />
    </div>
  )
}

