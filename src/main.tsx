import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import './styles/global.css';

const container = document.getElementById('root')!;
let root = ReactDOM.createRoot(container);
const render = () => root.render(<React.StrictMode><App /></React.StrictMode>);
render();
// BFCache復帰時に入力を残さない。
window.addEventListener('pagehide', () => root.unmount());
window.addEventListener('pageshow', (event) => {
  if (event.persisted) { root = ReactDOM.createRoot(container); render(); }
});
