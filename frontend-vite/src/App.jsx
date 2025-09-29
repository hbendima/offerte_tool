import React, { useState } from "react";
import LoginForm from "./components/LoginForm";

function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <LoginForm onLogin={setUser} />;
  }

  return (
    <div>
      <h1>Welkom, {user.username}!</h1>
      {/* Hier kun je je dashboard of offerte-functionaliteit tonen */}
    </div>
  );
}

export default App;