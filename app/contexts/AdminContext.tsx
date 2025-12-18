"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

/**
 * 管理员个人资料类型定义
 */
export interface AdminProfile {
  id?: number;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: "super_admin" | "admin" | string;
  isSuperAdmin: boolean;
}

/**
 * 管理员上下文状态类型
 */
interface AdminContextState {
  /** 当前登录管理员的资料，未登录时为 null */
  profile: AdminProfile | null;
  /** 是否正在加载管理员信息 */
  loading: boolean;
  /** 加载过程中的错误信息 */
  error: string | null;
  /** 是否已完成初始化加载（无论成功与否） */
  initialized: boolean;
  /** 是否已认证 */
  isAuthed: boolean;
  /** 手动刷新管理员信息 */
  refreshProfile: () => Promise<void>;
  /** 更新管理员资料（局部更新，用于资料修改后同步） */
  updateProfile: (updates: Partial<AdminProfile>) => void;
  /** 清除管理员状态（用于登出） */
  clearAdmin: () => void;
}

const AdminContext = createContext<AdminContextState | null>(null);

/**
 * 获取管理员上下文的 Hook
 * 在 AdminProvider 外部调用会抛出错误
 */
export function useAdmin(): AdminContextState {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin 必须在 AdminProvider 内部使用");
  }
  return context;
}

/**
 * 可选的管理员上下文 Hook
 * 在 AdminProvider 外部调用返回 null，不会抛出错误
 */
export function useOptionalAdmin(): AdminContextState | null {
  return useContext(AdminContext);
}

interface AdminProviderProps {
  children: ReactNode;
}

/**
 * 管理员状态提供者组件
 * 在管理端应用最外层包裹，自动从 localStorage 读取登录状态并预加载管理员信息
 */
export function AdminProvider({ children }: AdminProviderProps) {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  /**
   * 从后端加载管理员资料
   */
  const loadProfile = useCallback(async (email: string): Promise<AdminProfile | null> => {
    try {
      const res = await fetch(`/api/user/profile?email=${encodeURIComponent(email)}`);
      if (!res.ok) {
        return null;
      }
      const data = (await res.json()) as {
        id?: number;
        username: string;
        email: string;
        avatarUrl: string | null;
        isAdmin?: boolean;
      };

      // 从 localStorage 获取角色信息（因为 profile API 不返回角色）
      const storedRole = typeof window !== "undefined"
        ? window.localStorage.getItem("adminRole")
        : null;
      const role = storedRole || "admin";
      const isSuperAdmin = role === "super_admin";

      return {
        id: data.id,
        username: data.username,
        email: data.email,
        avatarUrl: data.avatarUrl,
        role,
        isSuperAdmin,
      };
    } catch {
      return null;
    }
  }, []);

  /**
   * 初始化：从 localStorage 读取登录状态，并预加载管理员信息
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const initAdmin = async () => {
      setLoading(true);
      setError(null);

      try {
        const isAdmin = window.localStorage.getItem("isAdmin");
        const email = window.localStorage.getItem("adminEmail");
        const storedAvatar = window.localStorage.getItem("adminAvatarUrl");
        const storedRole = window.localStorage.getItem("adminRole");
        const storedName = window.localStorage.getItem("adminName");

        const authed = isAdmin === "true" && !!email;
        setIsAuthed(authed);

        if (!authed || !email) {
          // 未登录
          setProfile(null);
          return;
        }

        // 先使用 localStorage 中的缓存数据立即显示
        const role = storedRole || "admin";
        const cachedProfile: AdminProfile = {
          email,
          username: storedName || email,
          avatarUrl: storedAvatar || null,
          role,
          isSuperAdmin: role === "super_admin",
        };
        setProfile(cachedProfile);

        // 然后在后台静默刷新最新数据
        const freshProfile = await loadProfile(email);
        if (freshProfile) {
          setProfile(freshProfile);

          // 同步更新 localStorage 缓存
          window.localStorage.setItem("adminName", freshProfile.username || "");
          if (freshProfile.avatarUrl) {
            window.localStorage.setItem("adminAvatarUrl", freshProfile.avatarUrl);
          } else {
            window.localStorage.removeItem("adminAvatarUrl");
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载管理员信息失败");
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    initAdmin();
  }, [loadProfile]);

  /**
   * 刷新管理员资料
   */
  const refreshProfile = useCallback(async () => {
    if (typeof window === "undefined") return;

    const email = window.localStorage.getItem("adminEmail");
    if (!email) return;

    setLoading(true);
    setError(null);

    try {
      const freshProfile = await loadProfile(email);
      if (freshProfile) {
        setProfile(freshProfile);

        // 同步更新 localStorage
        window.localStorage.setItem("adminName", freshProfile.username || "");
        if (freshProfile.avatarUrl) {
          window.localStorage.setItem("adminAvatarUrl", freshProfile.avatarUrl);
        } else {
          window.localStorage.removeItem("adminAvatarUrl");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "刷新管理员信息失败");
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  /**
   * 局部更新管理员资料（用于资料修改后同步）
   */
  const updateProfile = useCallback((updates: Partial<AdminProfile>) => {
    setProfile((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };

      // 同步更新 localStorage
      if (typeof window !== "undefined") {
        if (updates.username !== undefined) {
          window.localStorage.setItem("adminName", updates.username || "");
        }
        if (updates.avatarUrl !== undefined) {
          if (updates.avatarUrl) {
            window.localStorage.setItem("adminAvatarUrl", updates.avatarUrl);
          } else {
            window.localStorage.removeItem("adminAvatarUrl");
          }
        }
        if (updates.email !== undefined) {
          window.localStorage.setItem("adminEmail", updates.email);
        }
        if (updates.role !== undefined) {
          window.localStorage.setItem("adminRole", updates.role);
        }
      }

      // 触发事件通知其他组件更新
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("admin-avatar-updated", {
            detail: {
              avatarUrl: updated.avatarUrl,
              displayName: updated.username,
            },
          })
        );
      }

      return updated;
    });
  }, []);

  /**
   * 清除管理员状态（登出时调用）
   * 同时清空所有本地缓存（localStorage 和 sessionStorage）
   */
  const clearAdmin = useCallback(() => {
    setProfile(null);
    setError(null);
    setIsAuthed(false);

    if (typeof window !== "undefined") {
      // 清空所有本地缓存
      window.localStorage.clear();
      window.sessionStorage.clear();
    }
  }, []);

  const value: AdminContextState = {
    profile,
    loading,
    error,
    initialized,
    isAuthed,
    refreshProfile,
    updateProfile,
    clearAdmin,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

