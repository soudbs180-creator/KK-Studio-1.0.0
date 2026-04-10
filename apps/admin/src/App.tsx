import React from 'react';
import { BrowserRouter } from 'react-router-dom';

import AdminRouter from './routes/AdminRouter';

export default function App() {
  return (
    <BrowserRouter>
      <AdminRouter />
    </BrowserRouter>
  );
}
