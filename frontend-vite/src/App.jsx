import React, { useState } from "react";
import LoginForm from "./components/LoginForm";
import Dashboard from "./components/Dashboard"; // <-- Dashboard importeren
import QuotationTool from './components/QuotationTool';// <-- QuotationTool importeren <QuotationTool />

function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <LoginForm onLogin={setUser} />;
  }

  // Toon nu het dashboard na login
  return (
    <Dashboard user={user} />
  );
}

export default App;