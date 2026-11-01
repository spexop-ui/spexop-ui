// Independent browser harness for the public synthetic Input fixture.
// Copy into src/main.tsx in a fresh fixture copy; do not change the model candidate.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Input } from './Input';
import './tokens.css';

function App() {
  const [value, setValue] = useState('');
  const [disabled, setDisabled] = useState(false);
  return <>
    <Input id="email" label="Email" value={value} onChange={setValue} disabled={disabled} />
    <label htmlFor="toggle-disabled">Disabled</label>
    <input id="toggle-disabled" type="checkbox" checked={disabled} onChange={event => setDisabled(event.target.checked)} />
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
