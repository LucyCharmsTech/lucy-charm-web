export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50font-sans">
      {/* Header */}
      <header className="w-full bg-white  shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900 ">Lucy Charms</h1>
          <nav className="space-x-6">
            <a href="#buy" className="text-gray-700  hover:text-blue-600">Buy</a>
            <a href="#sell" className="text-gray-700  hover:text-blue-600">Sell</a>
            <a href="#contact" className="text-gray-700  hover:text-blue-600">Contact</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex flex-1 flex-col items-center  bg-white justify-center text-center px-6 sm:px-16">
        <h2 className="text-[50px] sm:text-5xl font-bold text-green-900 mb-6">
          Find Your Dream Home with Lucy Charms
        </h2>
        <p className="text-lg sm:text-xl text-gray-700  mb-8 max-w-2xl">
          Explore listings, chat with our AI assistant, and schedule showings with ease. 
          Your journey to a new home starts here.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a
            href="#listings"
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition"
          >
            Browse Listings
          </a>
          <a
            href="#contact"
            className="px-6 py-3 border border-blue-600 text-blue-600 font-semibold rounded-md hover:bg-blue-50  transition"
          >
            Contact an Agent
          </a>
        </div>

        
      </main>

      {/* Footer */}
      <footer className="w-full bg-white  border-t border-gray-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto text-center text-gray-700 ">
          © {new Date().getFullYear()} Lucy Charms Realty. All rights reserved.
        </div>
      </footer>
    </div>
  );
}