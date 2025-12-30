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
 * 在管理端应用最外层包裹：基于 httpOnly Session Cookie 拉取管理员信息（不再依赖 localStorage 传参）
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
  const loadProfile = useCallback(async (): Promise<AdminProfile | null> => {
    try {
      const res = await fetch("/api/admin/me", {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        return null;
      }
      const data = (await res.json()) as { ok: boolean; admin: AdminProfile };
      return data.admin ?? null;
    } catch {
      return null;
    }
  }, []);

  /**
   * 初始化：从服务端拉取管理员信息（基于 httpOnly cookie）
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const initAdmin = async () => {
      setLoading(true);
      setError(null);

      try {
        const freshProfile = await loadProfile();
        const authed = !!freshProfile;
        setIsAuthed(authed);
        setProfile(freshProfile);
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

    setLoading(true);
    setError(null);

    try {
      const freshProfile = await loadProfile();
      if (freshProfile) {
        setProfile(freshProfile);
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

    // 安全：不清空主题/语言偏好（localStorage）；仅清理一次性缓存与遗留管理员信息 key
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.clear();
      } catch {
        // ignore
      }
      try {
        // 兼容旧实现可能遗留的管理员身份信息（避免共享设备泄露）
        window.localStorage.removeItem("loggedInAdminEmail");
        window.localStorage.removeItem("loggedInAdminName");
        window.localStorage.removeItem("loggedInAdminAvatar");
      } catch {
        // ignore
      }
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

