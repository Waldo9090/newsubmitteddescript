import Header from "../components/Header"
import Footer from "../components/Footer"
import ReleasesList from "./components/ReleasesList"

export const metadata = {
  title: "Releases - Descript AI",
  description: "Latest updates and improvements to Descript AI",
}

export default function ReleasesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow pt-20">
        <ReleasesList />
      </main>
      <Footer />
    </div>
  )
}

