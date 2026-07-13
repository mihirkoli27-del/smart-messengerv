import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ChatPage } from './pages/ChatPage';
import { AdminPage } from './pages/AdminPage';

// A route wrapper that delays rendering until user validation finishes and redirects to /login if unauthenticated
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-screen bg-slate-950 flex items-center justify-center text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <Router>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ResetPasswordPage />} />
            
            {/* Protected Moderator Dashboard */}
            <Route
              path="/admin"
              element={
                <PrivateRoute>
                  <AdminPage />
                </PrivateRoute>
              }
            />

            {/* Protected Chat Workspace */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <ChatPage />
                </PrivateRoute>
              }
            />

            {/* Catch-all Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ChatProvider>
    </AuthProvider>
  );
}

export default App;
