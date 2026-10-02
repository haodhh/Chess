import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyPieceSet, storedPieceSet } from './components/pieceSet';
import './index.css';

applyPieceSet(storedPieceSet());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
