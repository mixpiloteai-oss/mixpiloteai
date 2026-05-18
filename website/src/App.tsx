import { Routes, Route } from 'react-router-dom'
import Nav from './components/Nav'
import Footer from './components/Footer'
import Landing from './pages/Landing'
import Download from './pages/Download'
import Pricing from './pages/Pricing'
import Changelog from './pages/Changelog'
import Support from './pages/Support'
import Login from './pages/Login'
import Account from './pages/Account'
import Marketplace from './pages/Marketplace'
import Merch from './pages/Merch'

function App() {
  return (
    <div className="app">
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/download" element={<Download />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/changelog" element={<Changelog />} />
          <Route path="/support" element={<Support />} />
          <Route path="/login" element={<Login />} />
          <Route path="/account" element={<Account />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/merch" element={<Merch />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
