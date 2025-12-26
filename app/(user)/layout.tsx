"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
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
import type { MenuProps } from "antd";
import {
  HomeOutlined,
  UserOutlined,
  LaptopOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  LogoutOutlined,
  TranslationOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  SunOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  applyLanguage,
  applyTheme,
  getInitialLanguage,
  getInitialTheme,
  type AppLanguage,
  type AppTheme,
} from "../client-prefs";
import { getUserMessages, type UserMessages } from "../user-i18n";
import FeedbackBubble from "../components/FeedbackBubble";
import UserNotificationBell from "../components/UserNotificationBell";
import { UserProvider, useOptionalUser } from "../contexts/UserContext";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;
const { useToken } = antTheme;

// Define interface for AppLayout props
interface AppLayoutProps {
  theme: AppTheme;
  isMobile: boolean;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileDrawerOpen: boolean;
  setMobileDrawerOpen: (open: boolean) => void;
  selectedKeys: string[];
  openKeys: string[];
  setOpenKeys: (keys: string[]) => void;
  menuItems: MenuProps["items"];
  messages: UserMessages;
  language: AppLanguage;
  toggleLanguage: () => void;
  toggleTheme: () => void;
  searchValue: string;
  setSearchValue: (value: string) => void;
  handleSearch: (value: string) => void;
  userMenuProps: MenuProps;
  avatarUrl: string | null;
  displayName: string | null;
  children: React.ReactNode;
}

/**
 * 用户端布局组件（外层包装）
 * 使用 UserProvider 提供全局用户状态
 */
export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <UserLayoutInner>{children}</UserLayoutInner>
    </UserProvider>
  );
}

/**
 * 用户端布局内部组件
 * 使用 Ant Design 组件库重构
 */
function UserLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const userContext = useOptionalUser();

  // 响应式断点
  const screens = useBreakpoint();
  // md: 768px. 如果大于 md，通常认为是桌面端
  const isMobile = !screens.md;

  // 用户信息
  const hasUser = !!userContext?.profile;
  const avatarUrl = userContext?.profile?.avatarUrl ?? null;
  const displayName =
    userContext?.profile?.username ?? userContext?.profile?.email ?? null;

  // 主题与语言
  const [theme, setTheme] = useState<AppTheme>(() => getInitialTheme());
  const [language, setLanguage] = useState<AppLanguage>(() => getInitialLanguage());
  const messages = getUserMessages(language);

  // 菜单状态
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  
  // 搜索
  const [searchValue, setSearchValue] = useState("");

  // 初始化主题 / 语言
  useEffect(() => {
    applyTheme(theme);
    applyLanguage(language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // 监听 pathname 和 hash 变化同步菜单选中状态
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncMenuState = () => {
      let keys: string[] = [];
      let opens: string[] = [];

      if (pathname === "/") {
        keys = ["home"];
      } else if (pathname === "/profile") {
        keys = ["profile"];
      } else if (pathname === "/devices") {
        const hash = window.location.hash;
        opens = ["devices"]; // 展开设备菜单
        if (hash === "#warranty-section") {
          keys = ["warranty"];
        } else {
          keys = ["order"];
        }
      }

      setSelectedKeys(keys);
      // 仅在非折叠状态或初始化时设置展开
      if (!collapsed) {
        setOpenKeys((prev) => Array.from(new Set([...prev, ...opens])));
      }
    };

    syncMenuState();
    window.addEventListener("hashchange", syncMenuState);
    return () => {
      window.removeEventListener("hashchange", syncMenuState);
    };
  }, [pathname, collapsed]);

  // 切换主题
  const toggleTheme = () => {
    const next: AppTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  // 切换语言
  const toggleLanguage = () => {
    const next: AppLanguage = language === "zh-CN" ? "en-US" : "zh-CN";
    setLanguage(next);
    applyLanguage(next);
  };

  // 退出登录
  const logout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      userContext?.clearUser();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  };

  // 搜索逻辑
  const handleSearch = (value: string) => {
    const keyword = value.trim().toLowerCase();
    if (!keyword) return;

    const routes: { href: string; keywords: string[] }[] = [
      { href: "/", keywords: ["首页", "home", "index"] },
      { href: "/profile", keywords: ["信息", "资料", "profile", "account"] },
      { href: "/devices", keywords: ["设备", "device", "devices"] },
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

  // 菜单项配置
  const menuItems: MenuProps["items"] = [
    {
      key: "home",
      icon: <HomeOutlined />,
      label: messages.layout.navHome,
      onClick: () => {
        router.push("/");
        setMobileDrawerOpen(false);
      },
    },
    {
      key: "profile",
      icon: <UserOutlined />,
      label: messages.layout.navProfile,
      onClick: () => {
        router.push("/profile");
        setMobileDrawerOpen(false);
      },
    },
    {
      key: "devices",
      icon: <LaptopOutlined />,
      label: messages.layout.navDevices,
      children: [
        {
          key: "order",
          icon: <FileTextOutlined />,
          label: language === "zh-CN" ? "订单信息" : "Order info",
          onClick: () => {
            router.push("/devices#order-section");
            setMobileDrawerOpen(false);
            // 触发自定义事件通知页面切换Tab (兼容旧代码逻辑)
            window.dispatchEvent(
              new CustomEvent("user-devices-section-changed", {
                detail: { section: "order" },
              })
            );
          },
        },
        {
          key: "warranty",
          icon: <SafetyCertificateOutlined />,
          label: language === "zh-CN" ? "质保信息" : "Warranty info",
          onClick: () => {
            router.push("/devices#warranty-section");
            setMobileDrawerOpen(false);
            window.dispatchEvent(
              new CustomEvent("user-devices-section-changed", {
                detail: { section: "warranty" },
              })
            );
          },
        },
      ],
    },
  ];

  // 用户下拉菜单
  const userMenuProps: MenuProps = {
    items: [
      {
        key: "profile",
        icon: <UserOutlined />,
        label: messages.layout.navProfile,
        onClick: () => router.push("/profile"),
      },
      {
        type: "divider",
      },
      {
        key: "logout",
        icon: <LogoutOutlined />,
        label: messages.layout.logout,
        onClick: logout,
        danger: true,
      },
    ],
  };

  // 通用布局配置
  const commonConfigProviderProps = {
    theme: {
      algorithm:
        theme === "dark" ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
      token: {
        colorPrimary: "#1677ff",
        borderRadius: 6,
        // 确保用户端（AntD）字体与管理端一致（全局 body 也是这套）
        fontFamily: "Arial, Helvetica, sans-serif",
      },
    }
  };

  // 登录页面等特殊处理
  if (
    pathname === "/login" ||
    pathname === "/register"
  ) {
    return (
      <ConfigProvider {...commonConfigProviderProps}>
        {children}
      </ConfigProvider>
    );
  }

  // 未登录
  if (!hasUser) {
    return (
      <ConfigProvider {...commonConfigProviderProps}>
        {children}
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider {...commonConfigProviderProps}>
      <AppLayout
        theme={theme}
        isMobile={isMobile}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileDrawerOpen={mobileDrawerOpen}
        setMobileDrawerOpen={setMobileDrawerOpen}
        selectedKeys={selectedKeys}
        openKeys={openKeys}
        setOpenKeys={setOpenKeys}
        menuItems={menuItems}
        messages={messages}
        language={language}
        toggleLanguage={toggleLanguage}
        toggleTheme={toggleTheme}
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        handleSearch={handleSearch}
        userMenuProps={userMenuProps}
        avatarUrl={avatarUrl}
        displayName={displayName}
      >
        {children}
      </AppLayout>
    </ConfigProvider>
  );
}

// 拆分内部 Layout 组件以使用 useToken
function AppLayout({
  theme: appTheme,
  isMobile,
  collapsed,
  setCollapsed,
  mobileDrawerOpen,
  setMobileDrawerOpen,
  selectedKeys,
  openKeys,
  setOpenKeys,
  menuItems,
  messages,
  language,
  toggleLanguage,
  toggleTheme,
  searchValue,
  setSearchValue,
  handleSearch,
  userMenuProps,
  avatarUrl,
  displayName,
  children
}: AppLayoutProps) {
  const { token } = useToken();

  // 根据当前 Token 计算背景色，确保 Sider 和 Header 一致
  // 在 Light 模式下：colorBgContainer 通常是白色 #ffffff
  // 在 Dark 模式下：colorBgContainer 通常是深灰色 #141414
  // 这样可以避免 Sider 使用默认深蓝色主题导致的样式不统一
  const layoutBgColor = token.colorBgContainer;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* 侧边栏 - 桌面端 */}
      {!isMobile && (
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          // 在 Dark 模式下也使用 "light" theme，但覆盖 background，从而避免 AntD 默认的深蓝侧边栏
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
            theme="light" // 强制使用 light theme (配合外层 Dark Algorithm 会自动变黑)
            mode="inline"
            selectedKeys={selectedKeys}
            openKeys={openKeys}
            onOpenChange={(keys) => setOpenKeys(keys as string[])}
            items={menuItems}
            className="user-adminlike-menu"
            style={{ 
              background: "transparent",
              borderRight: 0 
            }}
          />
        </Sider>
      )}

      {/* 侧边栏 - 移动端 Drawer */}
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
        {/* 顶部导航栏 */}
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
                style={{
                  fontSize: "16px",
                  width: 46,
                  height: 46,
                }}
              />
            )}
          </div>

          <Space size={16} align="center">
            {!isMobile && (
              <Input
                prefix={<SearchOutlined className="text-gray-400" />}
                placeholder={messages.layout.searchPlaceholder}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onPressEnter={() => handleSearch(searchValue)}
                allowClear
                style={{ width: 200 }}
                variant="filled"
              />
            )}

            <div className="flex items-center">
              <UserNotificationBell />
            </div>

            <Button
              type="text"
              icon={<TranslationOutlined />}
              onClick={toggleLanguage}
              title={language === "zh-CN" ? "Switch to English" : "切换到中文"}
            />

            <Button
              type="text"
              icon={appTheme === "dark" ? <SunOutlined /> : <MoonOutlined />}
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
                  style={{
                    backgroundColor: avatarUrl ? "transparent" : "#1890ff",
                  }}
                />
                {!isMobile && displayName && (
                  <span style={{ marginLeft: 8, maxWidth: 100 }} className="truncate">
                    {displayName}
                  </span>
                )}
              </div>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            margin: "24px 16px",
            padding: 24,
            minHeight: 280,
            background: layoutBgColor,
            borderRadius: 8,
            overflow: "initial",
          }}
        >
          <FeedbackBubble />
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
