import { useState, useEffect } from "react";
import { onAuthStateChanged, auth } from "./lib/firebase";
import Auth from "./components/Auth";
import Dashboard from "./Dashboard";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);   // ← Adicionado

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);        // ← Importante
    });

    // Cleanup
    return () => unsubscribe();
  }, []);

  // Enquanto verifica o login, mostra carregando
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#09090c",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#787480",
        fontSize: "15px"
      }}>
        Carregando...
      </div>
    );
  }

  return user ? <Dashboard /> : <Auth onAuthSuccess={() => setUser(auth.currentUser)} />;
}

export default App;
