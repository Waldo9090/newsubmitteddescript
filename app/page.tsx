'use client';

import Header from "./components/Header"
import Hero from "./components/Hero"
import FeatureBoxes from "./components/FeatureBoxes"
import Features from "./components/Features"
import FAQ from "./components/FAQ"
import CTA from "./components/CTA"
import Footer from "./components/Footer"
import { useAuth } from "@/context/auth-context"

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main>
        <Hero />
        <Features />
        <FeatureBoxes />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
