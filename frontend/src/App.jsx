import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useState, useEffect } from 'react';
import Home from './pages/Home';
import Watch from './pages/Watch';
import Creator from './pages/Creator';
import Disclaimer from './pages/Disclaimer';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AgeVerification from './components/AgeVerification';

function App() {
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('ageVerified');
    if (saved === 'true') {
      setIsVerified(true);
    }
  }, []);

  return (
    <BrowserRouter>
      <Helmet>
        <title>Nighthub - Video Streaming Platform</title>
        <meta name="description" content="Nighthub is a modern video streaming platform. Browse trending videos, search for content, and watch your favorite videos." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta charSet="UTF-8" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Nighthub - Video Streaming Platform" />
        <meta property="og:description" content="Nighthub is a modern video streaming platform. Browse trending videos, search for content, and watch your favorite videos." />
        <meta property="og:site_name" content="Nighthub" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Nighthub - Video Streaming Platform" />
        <meta name="twitter:description" content="Nighthub is a modern video streaming platform. Browse trending videos, search for content, and watch your favorite videos." />
      </Helmet>
      <div className="min-h-screen bg-[#0f0f13] text-white flex flex-col font-sans">
        <AgeVerification isVerified={isVerified} setIsVerified={setIsVerified} />
        {isVerified && <Navbar />}
        <main className="flex-1 max-w-[1600px] mx-auto w-full">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/watch/:id" element={<Watch />} />
            <Route path="/creator/:slug" element={<Creator />} />
            <Route path="/disclaimer" element={<Disclaimer />} />
          </Routes>
        </main>
        {isVerified && <Footer />}
      </div>
    </BrowserRouter>
  );
}

export default App;
