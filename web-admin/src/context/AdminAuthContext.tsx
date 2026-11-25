import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { AdminUser } from "../components/AdminLogin";
import { ADMIN_SESSION_STORAGE_KEY, fetchAdminSession } from "../lib/api";

interface AdminAuthContextType {
  adminUser: AdminUser | null;
  login: (user: AdminUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const logout = useCallback(() => {
    setAdminUser(null);
    try {
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    } catch (e) {
      console.error("Failed to clear admin session", e);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        const stored = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored) as AdminUser;
        if (!parsed?.token) {
          localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
          return;
        }
        // Xác thực chữ ký JWT & role thật từ Backend (chống giả mạo localStorage)
        setAdminUser(parsed);
        try {
          const res = await fetchAdminSession();
          if (active && res?.data?.user) {
            const verifiedUser: AdminUser = {
              ...res.data.user,
              token: parsed.token,
            };
            setAdminUser(verifiedUser);
            localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(verifiedUser));
          }
        } catch {
          if (active) {
            setAdminUser(null);
            localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
          }
        }
      } catch (e) {
        console.error("Failed to parse admin session", e);
        localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
      } finally {
        if (active) setIsInitialized(true);
      }
    };

    void bootstrap();
    const onUnauthorized = () => logout();
    window.addEventListener("safesolo:admin-unauthorized", onUnauthorized);
    return () => {
      active = false;
      window.removeEventListener("safesolo:admin-unauthorized", onUnauthorized);
    };
  }, [logout]);

  const login = (user: AdminUser) => {
    setAdminUser(user);
    try {
      localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(user));
    } catch (e) {
      console.error("Failed to save admin session", e);
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{
        adminUser,
        login,
        logout,
        isAuthenticated: Boolean(adminUser && adminUser.token),
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
