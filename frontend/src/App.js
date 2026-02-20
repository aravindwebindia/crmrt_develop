import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import UserManagement from './components/UserManagement';
import Profile from './components/Profile';
import Services from './components/Services';
import Contacts from './components/Contacts';
import Tax from './components/Tax';
import Quotation from './components/Quotation';
import SaleOrder from './components/SaleOrder';
import ProformaInvoice from './components/ProformaInvoice';
import RecurringInvoice from './components/RecurringInvoice';
import Reports from './components/Reports';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="App">
        <Routes>
          <Route 
            path="/login" 
            element={user ? <Navigate to="/dashboard" /> : <Login />} 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/users" 
            element={
              <ProtectedRoute requiredRole="admin">
                <UserManagement />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/services" 
            element={
              <ProtectedRoute>
                <Services />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/contacts" 
            element={
              <ProtectedRoute>
                <Contacts />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/tax" 
            element={
              <ProtectedRoute>
                <Tax />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/quotations" 
            element={
              <ProtectedRoute>
                <Quotation />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/sale-orders" 
            element={
              <ProtectedRoute>
                <SaleOrder />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/proforma-invoices" 
            element={
              <ProtectedRoute>
                <ProformaInvoice />
              </ProtectedRoute>
            } 
          />
        <Route 
          path="/recurring-invoice" 
          element={
            <ProtectedRoute>
              <RecurringInvoice />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/reports" 
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          } 
        />
          <Route 
            path="/bill-followup" 
            element={<Navigate to="/recurring-invoice" replace />} 
          />
          <Route 
            path="/" 
            element={<Navigate to="/dashboard" />} 
          />
        </Routes>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </div>
    </Router>
  );
}

export default App;
