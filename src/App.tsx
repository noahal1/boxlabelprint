import { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import BoxLabelForm from './pages/BoxLabelForm';
import BoxLabelList from './pages/BoxLabelList';
import Settings from './pages/Settings';

export type MenuKey = 'dashboard' | 'create' | 'list' | 'settings';

function App() {
  return (
    <HashRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create" element={<BoxLabelForm />} />
          <Route path="/list" element={<BoxLabelList />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </AppLayout>
    </HashRouter>
  );
}

export default App;
