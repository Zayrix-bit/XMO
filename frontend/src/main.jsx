import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { CategoriesProvider } from './context/CategoriesContext.jsx'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <CategoriesProvider>
        <App />
      </CategoriesProvider>
    </HelmetProvider>
  </StrictMode>,
)
