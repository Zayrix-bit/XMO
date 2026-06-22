import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const CategoriesContext = createContext();

export function CategoriesProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [normalCategories, setNormalCategories] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/api/categories');
        const cats = res.data.categories || [];
        const cntrs = res.data.countries || [];
        
        setNormalCategories(cats);
        setCountries(cntrs);
        setCategories([...cats, ...cntrs]);
      } catch (err) {
        console.error("Error fetching categories:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCategories();
  }, []);

  return (
    <CategoriesContext.Provider 
      value={{ 
        categories, 
        normalCategories, 
        countries, 
        loading 
      }}
    >
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  return useContext(CategoriesContext);
}
