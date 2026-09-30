import React, { createContext, useContext, useState, useEffect } from "react";
import { AdminUser } from "../components/AdminLogin";

interface AdminAuthContextType {
  adminUser: AdminUser | null;
  login: (user: AdminUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const STORAGE_KEY = "safesolo_admin_session_v1";

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setAdminUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to parse admin session", e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  const login = (user: AdminUser) => {
    setAdminUser(user);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch (e) {
      console.error("Failed to save admin session", e);
    }
  };

  const logout = () => {
    setAdminUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error("Failed to clear admin session", e);
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{
        adminUser,
        login,
        logout,
        isAuthenticated: !!adminUser,
      }}
    >
      {isInitialized ? children : null}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
}
