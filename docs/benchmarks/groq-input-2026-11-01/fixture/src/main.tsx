import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Input } from './Input';
import './tokens.css';
function App() { const [value,setValue]=useState(''); return <><Input id="email" label="Email" value={value} onChange={setValue}/><Input id="disabled" label="Disabled" value="invalid" onChange={()=>{throw new Error('Disabled changed')}} disabled/><button type="button">Continue</button></>; }
createRoot(document.getElementById('root')!).render(<App/>);
