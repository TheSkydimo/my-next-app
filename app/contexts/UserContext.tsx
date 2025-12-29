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
 * 用户个人资料类型定义
 */
export interface UserProfile {
  id?: number;
  username: string;
  email: string;
  avatarUrl: string | null;
  isAdmin?: boolean;
  createdAt?: string;
}

/**
 * 用户上下文状态类型
 */
interface UserContextState {
  /** 当前登录用户的资料，未登录时为 null */
  profile: UserProfile | null;
  /** 是否正在加载用户信息 */
  loading: boolean;
  /** 加载过程中的错误信息 */
  error: string | null;
  /** 是否已完成初始化加载（无论成功与否） */
  initialized: boolean;
  /** 手动刷新用户信息 */
  refreshProfile: () => Promise<void>;
  /** 更新用户资料（局部更新，用于资料修改后同步） */
  updateProfile: (updates: Partial<UserProfile>) => void;
  /** 清除用户状态（用于登出） */
  clearUser: () => void;
}

const UserContext = createContext<UserContextState | null>(null);

/**
 * 获取用户上下文的 Hook
 * 在 UserProvider 外部调用会抛出错误
 */
export function useUser(): UserContextState {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser 必须在 UserProvider 内部使用");
  }
  return context;
}

/**
 * 可选的用户上下文 Hook
 * 在 UserProvider 外部调用返回 null，不会抛出错误
 */
export function useOptionalUser(): UserContextState | null {
  return useContext(UserContext);
}

interface UserProviderProps {
  children: ReactNode;
}

/**
 * 用户状态提供者组件
 * 在应用最外层包裹：基于 httpOnly session cookie 获取“我”的信息
 * 安全：不在 localStorage/sessionStorage 持久化保存用户邮箱等敏感信息（避免 XSS/共享设备泄露）
 */
export function UserProvider({ children }: UserProviderProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  /**
   * 从后端通过 Session Cookie 获取当前登录用户资料（记住登录状态）
   */
  const loadMe = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const res = await fetch("/api/user/me", { method: "GET", credentials: "include" });
      if (!res.ok) return null;
      const data = (await res.json()) as UserProfile;
      if (!data?.email) return null;
      return data;
    } catch {
      return null;
    }
  }, []);

  /**
   * 初始化：通过 cookie 恢复登录（未登录则 profile 为 null）
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const initUser = async () => {
      setLoading(true);
      setError(null);

      try {
        const me = await loadMe();
        setProfile(me);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载用户信息失败");
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    initUser();
  }, [loadMe]);

  /**
   * 刷新用户资料
   */
  const refreshProfile = useCallback(async () => {
    if (typeof window === "undefined") return;

    const me = await loadMe();
    setProfile(me);
  }, [loadMe]);

  /**
   * 局部更新用户资料（用于资料修改后同步）
   */
  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };

      // 触发事件通知其他组件更新
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("user-avatar-updated", {
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
   * 清除用户状态（登出时调用）
   * 安全：不清空主题/语言偏好（localStorage）；仅清理一次性缓存 + 遗留用户信息 key
   */
  const clearUser = useCallback(() => {
    setProfile(null);
    setError(null);

    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.clear();
      } catch {
        // ignore
      }
      try {
        window.localStorage.removeItem("loggedInUserEmail");
        window.localStorage.removeItem("loggedInUserName");
        window.localStorage.removeItem("loggedInUserAvatar");
      } catch {
        // ignore
      }
    }
  }, []);

  const value: UserContextState = {
    profile,
    loading,
    error,
    initialized,
    refreshProfile,
    updateProfile,
    clearUser,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

