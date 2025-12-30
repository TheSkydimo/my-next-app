"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  SearchOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  BellOutlined,
  SendOutlined,
  HistoryOutlined,
  FileTextOutlined,
  LogoutOutlined,
  TranslationOutlined,
  MoonOutlined,
  SunOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Menu,
  Button,
  Input,
  Dropdown,
  Avatar,
  ConfigProvider,
  theme as antTheme,
  Space,
  Drawer,
  Grid,
} from "antd";
import type { MenuProps, InputRef } from "antd";
import {
  applyLanguage,
  applyTheme,
  getInitialLanguage,
  getInitialTheme,
  type AppLanguage,
  type AppTheme,
} from "../client-prefs";
import { getAdminMessages } from "../admin-i18n";
import { AdminProvider, useOptionalAdmin } from "../contexts/AdminContext";
import {
  ADMIN_BOOTSTRAP_SESSION_STORAGE_KEY,
  ApiCacheProvider,
} from "../contexts/ApiCacheContext";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;
const { useToken } = antTheme;

/**
 * 管理端布局组件（外层包装）
 * 使用 AdminProvider 提供全局管理员状态
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <ApiCacheProvider bootstrapStorageKey={ADMIN_BOOTSTRAP_SESSION_STORAGE_KEY}>
        <AdminLayoutInner>{children}</AdminLayoutInner>
      </ApiCacheProvider>
    </AdminProvider>
  );
}

/**
 * 管理端布局内部组件
 * 使用 AdminContext 获取已预加载的管理员信息
 */
function AdminLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const adminContext = useOptionalAdmin();

  // 从 AdminContext 获取管理员信息，避免重复请求
  const isAuthed = adminContext?.isAuthed ?? false;
  const avatarUrl = adminContext?.profile?.avatarUrl ?? null;
  const displayName = adminContext?.profile?.username ?? adminContext?.profile?.email ?? null;
  const adminRole = adminContext?.profile?.role ?? null;
  const initialized = adminContext?.initialized ?? false;

  // 响应式断点
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [theme, setTheme] = useState<AppTheme>(() => getInitialTheme());
  const [language, setLanguage] = useState<AppLanguage>(() => getInitialLanguage());
  const [searchValue, setSearchValue] = useState("");
  const searchInputRef = useRef<InputRef | null>(null);
  const messages = getAdminMessages(language);

  // 菜单状态（对齐用户端）
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  // 初始化主题 / 语言，并处理 Ctrl + K 聚焦搜索框
  useEffect(() => {
    applyTheme(theme);
    applyLanguage(language);

    const keyHandler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", keyHandler);
    return () => {
      window.removeEventListener("keydown", keyHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = () => {
    // 使用 AdminContext 清除管理员状态
    adminContext?.clearAdmin();
    if (typeof window !== "undefined") {
      // 最佳努力清理服务端 Session Cookie
      void fetch("/api/logout", { method: "POST" }).catch(() => {
        // ignore
      });
      window.location.href = "/admin/login";
    }
  };

  // 已登录管理员，展示侧边栏 + 子页面内容
  const isSuperAdmin = adminRole === "super_admin";
  const roleLabel =
    adminRole === "super_admin"
      ? messages.layout.roleSuperAdmin
      : adminRole === "admin"
      ? messages.layout.roleAdmin
      : null;

  const toggleTheme = () => {
    const next: AppTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  const toggleLanguage = () => {
    const next: AppLanguage = language === "zh-CN" ? "en-US" : "zh-CN";
    setLanguage(next);
    applyLanguage(next);
  };

  const triggerSearch = () => {
    if (typeof window === "undefined") return;
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return;

    const routes: { href: string; keywords: string[] }[] = [
      {
        href: "/admin/users",
        keywords: ["用户", "users", "user"],
      },
      {
        href: "/admin/admins",
        keywords: ["管理员", "admin", "admins"],
      },
      {
        href: "/admin/notifications/send",
        keywords: ["通知", "消息", "站内信", "notification", "notifications", "message"],
      },
      {
        href: "/admin/notifications/history",
        keywords: ["通知历史", "历史通知", "history", "log", "events", "notification history"],
      },
      {
        href: "/admin/profile",
        keywords: ["个人信息", "信息", "资料", "profile", "account"],
      },
      {
        href: "/admin/logs",
        keywords: ["日志", "logs", "log", "sentry"],
      },
    ];

    const matched = routes.find((r) =>
      r.keywords.some((k) => keyword.includes(k.toLowerCase()))
    );

    if (matched) {
      router.push(matched.href);
    } else {
      window.alert(
        `${messages.layout.searchNotFound}${messages.layout.searchNotFoundHint}`
      );
    }
  };

  const isPublicRoute = pathname === "/admin/login";

  // 同步菜单选中状态
  useEffect(() => {
    const key =
      pathname === "/admin"
        ? "profile"
        : pathname === "/admin/profile"
        ? "profile"
        : pathname === "/admin/admins"
        ? "admins"
        : pathname === "/admin/users"
        ? "users"
        : pathname.startsWith("/admin/notifications")
        ? pathname.includes("/history")
          ? "notifications_history"
          : "notifications_send"
        : pathname === "/admin/logs"
        ? "logs"
        : "";

    setSelectedKeys(key ? [key] : []);
  }, [pathname]);

  // Ensure notification submenu is expanded when inside /admin/notifications/*
  useEffect(() => {
    if (!pathname.startsWith("/admin/notifications")) return;
    setOpenKeys((prev) => (prev.includes("notifications") ? prev : [...prev, "notifications"]));
  }, [pathname]);

  // Ensure user management submenu is expanded when inside /admin/users/* or /admin/admins/*
  useEffect(() => {
    if (!pathname.startsWith("/admin/users") && !pathname.startsWith("/admin/admins")) return;
    setOpenKeys((prev) => (prev.includes("user_management") ? prev : [...prev, "user_management"]));
  }, [pathname]);

  const commonConfigProviderProps = {
    theme: {
      algorithm:
        theme === "dark" ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
      token: {
        colorPrimary: "#1677ff",
        borderRadius: 6,
        fontFamily: "Arial, Helvetica, sans-serif",
      },
    },
  };

  // 登录页不做管理员登录校验，直接渲染内容
  if (isPublicRoute) {
    return (
      <ConfigProvider {...commonConfigProviderProps}>{children}</ConfigProvider>
    );
  }

  // 初始加载阶段，避免闪烁，什么都不渲染
  if (!initialized) {
    return null;
  }

  // 未登录管理员时，不展示内部内容和菜单
  if (!isAuthed) {
    return (
      <ConfigProvider {...commonConfigProviderProps}>
        <div className="auth-page">
          <div className="auth-card">
            <h1>{messages.layout.unauthTitle}</h1>
            <p>{messages.layout.unauthDesc}</p>
            <p style={{ marginTop: 12 }}>
              <Link href="/admin/login">{messages.layout.unauthLoginLink}</Link>
            </p>
          </div>
        </div>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider {...commonConfigProviderProps}>
      <AdminAntdShell
        theme={theme}
        language={language}
        isMobile={isMobile}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileDrawerOpen={mobileDrawerOpen}
        setMobileDrawerOpen={setMobileDrawerOpen}
        selectedKeys={selectedKeys}
        openKeys={openKeys}
        setOpenKeys={setOpenKeys}
        messages={messages}
        isSuperAdmin={isSuperAdmin}
        toggleLanguage={toggleLanguage}
        toggleTheme={toggleTheme}
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        triggerSearch={triggerSearch}
        searchInputRef={searchInputRef}
        avatarUrl={avatarUrl}
        displayName={displayName}
        roleLabel={roleLabel}
        logout={logout}
      >
        {children}
      </AdminAntdShell>
    </ConfigProvider>
  );
}

function AdminAntdShell({
  theme,
  language,
  isMobile,
  collapsed,
  setCollapsed,
  mobileDrawerOpen,
  setMobileDrawerOpen,
  selectedKeys,
  openKeys,
  setOpenKeys,
  messages,
  isSuperAdmin,
  toggleLanguage,
  toggleTheme,
  searchValue,
  setSearchValue,
  triggerSearch,
  searchInputRef,
  avatarUrl,
  displayName,
  roleLabel,
  logout,
  children,
}: {
  theme: AppTheme;
  language: AppLanguage;
  isMobile: boolean;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileDrawerOpen: boolean;
  setMobileDrawerOpen: (v: boolean) => void;
  selectedKeys: string[];
  openKeys: string[];
  setOpenKeys: (keys: string[]) => void;
  messages: ReturnType<typeof getAdminMessages>;
  isSuperAdmin: boolean;
  toggleLanguage: () => void;
  toggleTheme: () => void;
  searchValue: string;
  setSearchValue: (v: string) => void;
  triggerSearch: () => void;
  searchInputRef: React.RefObject<InputRef | null>;
  avatarUrl: string | null;
  displayName: string | null;
  roleLabel: string | null;
  logout: () => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const { token } = useToken();

  const layoutBgColor = token.colorBgContainer;

  const userManagementChildren: NonNullable<MenuProps["items"]> = [
    ...(isSuperAdmin
      ? ([
          {
            key: "admins",
            icon: <UserOutlined />,
            label: messages.layout.navAdmins,
            onClick: () => {
              router.push("/admin/admins");
              setMobileDrawerOpen(false);
            },
          } as NonNullable<MenuProps["items"]>[number],
        ] as NonNullable<MenuProps["items"]>)
      : []),
    {
      key: "users",
      icon: <UserOutlined />,
      label: messages.layout.navUsers,
      onClick: () => {
        router.push("/admin/users");
        setMobileDrawerOpen(false);
      },
    },
  ];

  const menuItems: MenuProps["items"] = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: messages.layout.navProfile,
      onClick: () => {
        router.push("/admin/profile");
        setMobileDrawerOpen(false);
      },
    },
    {
      key: "user_management",
      icon: <UserOutlined />,
      label: messages.layout.navUserManagement,
      children: userManagementChildren,
    },
    {
      key: "notifications",
      icon: <BellOutlined />,
      label: messages.layout.navNotifications,
      children: [
        {
          key: "notifications_send",
          icon: <SendOutlined />,
          label: messages.layout.navNotificationsSend,
          onClick: () => {
            router.push("/admin/notifications/send");
            setMobileDrawerOpen(false);
          },
        },
        {
          key: "notifications_history",
          icon: <HistoryOutlined />,
          label: messages.layout.navNotificationsHistory,
          onClick: () => {
            router.push("/admin/notifications/history");
            setMobileDrawerOpen(false);
          },
        },
      ],
    },
    {
      key: "logs",
      icon: <FileTextOutlined />,
      label: messages.layout.navLogs,
      onClick: () => {
        router.push("/admin/logs");
        setMobileDrawerOpen(false);
      },
    },
  ];

  const userMenuProps: MenuProps = {
    items: [
      ...(roleLabel
        ? [
            {
              key: "role",
              label: roleLabel,
              disabled: true,
            } as NonNullable<MenuProps["items"]>[number],
            { type: "divider" as const },
          ]
        : []),
      {
        key: "profile",
        icon: <UserOutlined />,
        label: messages.layout.userMenuProfile,
        onClick: () => router.push("/admin/profile"),
      },
      {
        type: "divider",
      },
      {
        key: "logout",
        icon: <LogoutOutlined />,
        label: messages.layout.userMenuLogout,
        onClick: logout,
        danger: true,
      },
    ],
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {!isMobile && (
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          theme="light"
          style={{
            overflow: "auto",
            height: "100vh",
            position: "sticky",
            left: 0,
            top: 0,
            bottom: 0,
            background: layoutBgColor,
            borderRight: `1px solid ${token.colorSplit}`,
          }}
        >
          <div
            style={{
              height: 64,
              margin: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              overflow: "hidden",
              color: token.colorText,
              fontWeight: "bold",
              fontSize: 18,
              whiteSpace: "nowrap",
              transition: "all 0.2s",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt={messages.layout.brand}
              style={{
                width: 32,
                height: 32,
                marginRight: collapsed ? 0 : 8,
                flexShrink: 0,
                objectFit: "contain",
              }}
            />
            {!collapsed && <span>{messages.layout.brand}</span>}
          </div>
          <Menu
            theme="light"
            mode="inline"
            selectedKeys={selectedKeys}
            openKeys={openKeys}
            onOpenChange={(keys) => setOpenKeys(keys as string[])}
            items={menuItems}
            className="user-adminlike-menu"
            style={{
              background: "transparent",
              borderRight: 0,
            }}
          />
        </Sider>
      )}

      <Drawer
        title={messages.layout.brand}
        placement="left"
        onClose={() => setMobileDrawerOpen(false)}
        open={mobileDrawerOpen && isMobile}
        width={240}
        styles={{ body: { padding: 0 } }}
      >
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          openKeys={openKeys}
          onOpenChange={(keys) => setOpenKeys(keys as string[])}
          items={menuItems}
          className="user-adminlike-menu"
          style={{ borderRight: 0 }}
        />
      </Drawer>

      <Layout>
        <Header
          style={{
            padding: "0 24px",
            background: layoutBgColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 1000,
            borderBottom: `1px solid ${token.colorSplit}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {isMobile ? (
              <Button
                type="text"
                icon={<MenuUnfoldOutlined />}
                onClick={() => setMobileDrawerOpen(true)}
                style={{ fontSize: "16px", width: 46, height: 46 }}
              />
            ) : (
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{ fontSize: "16px", width: 46, height: 46 }}
              />
            )}
          </div>

          <Space size={16} align="center">
            {!isMobile && (
              <Input
                ref={searchInputRef}
                prefix={<SearchOutlined className="text-gray-400" />}
                placeholder={messages.layout.searchPlaceholder}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onPressEnter={triggerSearch}
                allowClear
                style={{ width: 200 }}
                variant="filled"
              />
            )}

            <Button
              type="text"
              icon={<TranslationOutlined />}
              onClick={toggleLanguage}
              title={language === "zh-CN" ? "Switch to English" : "切换到中文"}
            />

            <Button
              type="text"
              icon={theme === "dark" ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleTheme}
              title="Toggle Theme"
            />

            <Dropdown menu={userMenuProps} placement="bottomRight" arrow>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 6,
                  transition: "background 0.3s",
                }}
                className="hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Avatar
                  src={avatarUrl}
                  icon={<UserOutlined />}
                  className="app-avatar"
                />
                {!isMobile && displayName && (
                  <span style={{ marginLeft: 8, maxWidth: 140 }} className="truncate">
                    {displayName}
                  </span>
                )}
              </div>
            </Dropdown>
          </Space>
        </Header>

        <Content
          className="admin-layout__content"
          style={{
            margin: "24px 16px",
            padding: 24,
            minHeight: 280,
            background: layoutBgColor,
            borderRadius: 8,
            // Keep scrolling inside content area (body is overflow:hidden in globals.css)
            overflow: "auto",
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
