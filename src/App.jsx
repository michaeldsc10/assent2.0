import { useState, useEffect } from "react";
import { onAuthStateChanged, auth } from "./lib/firebase";
import Auth from "./components/Auth";
import Dashboard from "./Dashboard";

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  return user ? <Dashboard /> : <Auth onLoginSuccess={() => {}} />;
}

export default App;
import Dashboard from "./Dashboard";

