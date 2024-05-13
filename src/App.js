import { useEffect, useState } from 'react';
import lit from './lit';
import './App.css';

function App() {
  const [client, setClient] = useState(lit);
  useEffect(() => {
    if(client !== null) {
      (async () => {
        await client.connect();
      })();
    }
  }, []);

  const myFunc = async () => {
    // await client.getAuthSig();
    const sessionSigs = await client.getSessionSigs();
    await client.encrypt(sessionSigs);
    // await client.litActions(sessionSigs);
  }

  const mySessionSig = async () => {
    const sessionSigs = await client.getPKPSessionSigs();
    console.log(sessionSigs);
  }

  return (
    <div className="App">
      <button onClick={myFunc}>Click me</button>
      <button onClick={mySessionSig}>SessionSig</button>
    </div>
  );
}

export default App;
