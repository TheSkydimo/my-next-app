"use client";

import type { AppLanguage } from "./client-prefs";

export type AdminMessages = {
  common: {
    adminLoginRequired: string;
    goAdminLogin: string;
    loading: string;
    unknownError: string;
  };
  layout: {
    brand: string;
    navHome: string;
    navProfile: string;
    navAdmins: string;
    navUsers: string;
    navOrders: string;
    navNotifications: string;
    navNotificationsSend: string;
    navNotificationsHistory: string;
    navLogs: string;
    roleSuperAdmin: string;
    roleAdmin: string;
    unauthTitle: string;
    unauthDesc: string;
    unauthLoginLink: string;
    searchPlaceholder: string;
    searchNotFound: string;
    searchNotFoundHint: string;
    userMenuNameFallback: string;
    userMenuProfile: string;
    userMenuLogout: string;
  };
  home: {
    title: string;
    welcomeLabel: string;
    emailLabel: string;
  };
  profile: {
    title: string;
    avatarNone: string;
    currentEmail: string;
    username: string;
    editUsername: string;
    setAvatar: string;
    changeAvatar: string;
    avatarDialogTitle: string;
    avatarDialogDesc: string;
    avatarDialogCancel: string;
    avatarDialogSave: string;
    usernameDialogTitle: string;
    usernameDialogCancel: string;
    usernameDialogSave: string;
    updateInfo: string;
    finishUpdateInfo: string;
    emailSectionTitle: string;
    emailSectionEdit: string;
    emailDialogTitle: string;
    emailDialogDesc: string;
    emailNewPlaceholder: string;
    emailCodePlaceholder: string;
    emailSendCode: string;
    emailSendingCode: string;
    emailDialogCancel: string;
    emailDialogConfirm: string;
    errorProfileLoadFailed: string;
    errorUsernameUpdateFailed: string;
    errorAvatarUpdateFailed: string;
    errorNewEmailRequired: string;
    errorSendCodeFailed: string;
    errorUpdateEmailFieldsRequired: string;
    errorUpdateEmailFailed: string;
    errorAvatarTooLarge: string;
    successUsernameUpdated: string;
    successAvatarUpdated: string;
    successCodeSent: string;
    successEmailUpdated: string;
  };
  users: {
    title: string;
    adminLabelPrefix: string;
    backToHome: string;
    searchPlaceholder: string;
    searchButton: string;
    resetButton: string;
    emptyText: string;
    fetchFailed: string;
    actionFailed: string;
    setVipPrompt: (currentDate: string) => string;
    setVipFailed: string;
    tableIndex: string;
    tableUsername: string;
    tableEmail: string;
    tableRole: string;
    tableVipStatus: string;
    tableVipExpiresAt: string;
    tableCreatedAt: string;
    tableActions: string;
    roleUser: string;
    roleAdmin: string;
    vipOn: string;
    vipOff: string;
    btnSetVip: string;
    btnSetAdmin: string;
    btnDelete: string;
    deleteConfirm: (username: string) => string;
    pagerPrev: string;
    pagerNext: string;
    pagerText: (page: number, totalPages: number, totalUsers: number) => string;
  };
  admins: {
    title: string;
    unauthorizedDesc: string;
    limitTip: string;
    emptyText: string;
    fetchFailed: string;
    actionFailed: string;
    deleteConfirm: (username: string) => string;
    tableIndex: string;
    tableUsername: string;
    tableEmail: string;
    tableCreatedAt: string;
    tableActions: string;
    btnUnsetAdmin: string;
    btnDelete: string;
  };
  orders: {
    title: string;
    adminLabelPrefix: string;
    backToHome: string;
    emptyText: string;
    fetchFailed: string;
    tableIndex: string;
    tableUserEmail: string;
    tableDeviceId: string;
    tableImage: string;
    tableNote: string;
    tableCreatedAt: string;
  };
  logs: {
    title: string;
    desc: string;
    openLogs: string;
    urlLabel: string;
    urlNotConfigured: string;
    configureHint: string;
  };
  notifications: {
    title: string;
    desc: string;
    scopeLabel: string;
    scopeValueAll: string;
    scopeFieldLabel: string;
    scopeAllUsers: string;
    scopeVipUsers: string;
    scopeNonVipUsers: string;
    scopeAdmins: string;
    scopeEmailList: string;
    audienceFieldLabel: string;
    audienceTooltip: string;
    audienceBoth: string;
    audienceZhOnly: string;
    audienceEnOnly: string;
    targetEmailsLabel: string;
    targetEmailsRequired: string;
    targetEmailsPlaceholder: string;
    levelLabel: string;
    levelInfo: string;
    levelWarn: string;
    levelCritical: string;
    typeLabel: string;
    typeTooltip: string;
    titleZhLabel: string;
    titleZhPlaceholder: string;
    bodyZhLabel: string;
    bodyZhPlaceholder: string;
    titleEnLabel: string;
    titleEnPlaceholder: string;
    bodyEnLabel: string;
    bodyEnPlaceholder: string;
    linkUrlLabel: string;
    linkUrlPlaceholder: string;
    sendButton: string;
    resetButton: string;
    errorTitleRequired: string;
    errorBodyRequired: string;
    successSent: string;
  };
  notificationsHistory: {
    title: string;
    desc: string;
    filterSearchLabel: string;
    filterSearchPlaceholder: string;
    filterTypeLabel: string;
    filterTypePlaceholder: string;
    filterLevelLabel: string;
    filterLevelAll: string;
    filterLevelInfo: string;
    filterLevelWarn: string;
    filterLevelCritical: string;
    filterStatusLabel: string;
    filterStatusAll: string;
    filterStatusSending: string;
    filterStatusSent: string;
    filterStatusFailed: string;
    applyButton: string;
    resetButton: string;
    tableId: string;
    tableLevel: string;
    tableType: string;
    tableTitle: string;
    tableStatus: string;
    tableCreatedAt: string;
    tableActions: string;
    actionView: string;
    actionEditResend: string;
    actionDelete: string;
    deleteConfirmTitle: string;
    deleteOkText: string;
    modalTitle: (id: number) => string;
    modalClose: string;
    modalCreated: string;
    modalError: string;
    modalNoLink: string;
    tagLevelInfo: string;
    tagLevelWarn: string;
    tagLevelCritical: string;
    tagStatusSending: string;
    tagStatusSent: string;
    tagStatusFailed: string;
    totalText: (total: number) => string;
  };
};

const zhCN: AdminMessages = {
  common: {
    adminLoginRequired: "未检测到管理员登录，请先登录管理员后台。",
    goAdminLogin: "去管理员登录",
    loading: "加载中...",
    unknownError: "发生未知错误",
  },
  layout: {
    brand: "Skydimo Admin",
    navHome: "首页",
    navProfile: "信息管理",
    navAdmins: "管理员管理",
    navUsers: "用户管理",
    navOrders: "订单截图",
    navNotifications: "通知",
    navNotificationsSend: "发送通知",
    navNotificationsHistory: "历史通知",
    navLogs: "日志",
    roleSuperAdmin: "超级管理员",
    roleAdmin: "管理员",
    unauthTitle: "管理后台",
    unauthDesc: "未检测到管理员登录，请先登录。",
    unauthLoginLink: "去登录",
    searchPlaceholder: "搜索功能 / Ctrl + K",
    searchNotFound: "未找到相关功能，请尝试：",
    searchNotFoundHint: "用户 / 管理员 / 通知 / 信息 / 日志 / 首页",
    userMenuNameFallback: "管理员",
    userMenuProfile: "个人中心",
    userMenuLogout: "退出登录",
  },
  home: {
    title: "管理后台",
    welcomeLabel: "欢迎，",
    emailLabel: "邮箱：",
  },
  profile: {
    title: "管理员信息",
    avatarNone: "无头像",
    currentEmail: "邮箱",
    username: "用户名",
    editUsername: "修改",
    setAvatar: "设置头像",
    changeAvatar: "更换头像",
    avatarDialogTitle: "设置头像",
    avatarDialogDesc:
      "你可以直接上传本地图片，或手动输入图片 URL。留空后保存则清除头像。",
    avatarDialogCancel: "取消",
    avatarDialogSave: "保存",
    usernameDialogTitle: "修改用户名",
    usernameDialogCancel: "取消",
    usernameDialogSave: "保存",
    updateInfo: "更新信息",
    finishUpdateInfo: "完成信息修改",
    emailSectionTitle: "修改邮箱",
    emailSectionEdit: "修改",
    emailDialogTitle: "确认修改邮箱",
    emailDialogDesc: "修改邮箱需要验证新邮箱验证码。修改完成后请使用新邮箱重新登录。",
    emailNewPlaceholder: "新邮箱",
    emailCodePlaceholder: "邮箱验证码",
    emailSendCode: "获取验证码",
    emailSendingCode: "发送中...",
    emailDialogCancel: "取消",
    emailDialogConfirm: "确认修改",
    errorProfileLoadFailed: "获取个人信息失败",
    errorUsernameUpdateFailed: "更新用户名失败",
    errorAvatarUpdateFailed: "更新头像失败",
    errorNewEmailRequired: "请先填写新邮箱",
    errorSendCodeFailed: "发送验证码失败",
    errorUpdateEmailFieldsRequired: "请填写新邮箱和邮箱验证码",
    errorUpdateEmailFailed: "修改邮箱失败",
    errorAvatarTooLarge: "头像图片大小请控制在 2MB 以内",
    successUsernameUpdated: "用户名已更新",
    successAvatarUpdated: "头像已更新",
    successCodeSent: "验证码已发送到新邮箱，请注意查收",
    successEmailUpdated: "邮箱已修改，请使用新邮箱登录",
  },
  users: {
    title: "普通用户管理",
    adminLabelPrefix: "当前管理员：",
    backToHome: "返回管理员首页",
    searchPlaceholder: "按用户名或邮箱搜索",
    searchButton: "搜索",
    resetButton: "重置",
    emptyText: "暂无用户。",
    fetchFailed: "获取用户列表失败",
    actionFailed: "操作失败",
    setVipPrompt: (currentDate: string) =>
      `请输入会员到期日期（格式：YYYY-MM-DD），留空表示取消会员：${currentDate}`,
    setVipFailed: "设置会员失败",
    tableIndex: "序号",
    tableUsername: "用户名",
    tableEmail: "邮箱",
    tableRole: "角色",
    tableVipStatus: "会员状态",
    tableVipExpiresAt: "会员到期时间",
    tableCreatedAt: "注册时间",
    tableActions: "操作",
    roleUser: "普通用户",
    roleAdmin: "管理员",
    vipOn: "会员中",
    vipOff: "非会员",
    btnSetVip: "设置会员",
    btnSetAdmin: "设为管理员",
    btnDelete: "删除",
    deleteConfirm: (username: string) =>
      `确定要删除用户「${username}」吗？`,
    pagerPrev: "上一页",
    pagerNext: "下一页",
    pagerText: (page, totalPages, totalUsers) =>
      `第 ${page} / ${totalPages} 页（共 ${totalUsers} 个用户）`,
  },
  admins: {
    title: "管理员管理",
    unauthorizedDesc: "当前账号不是超级管理员，无权访问该页面。",
    limitTip: "最多允许 15 个管理员。",
    emptyText: "当前没有管理员。",
    fetchFailed: "获取管理员列表失败",
    actionFailed: "操作失败",
    deleteConfirm: (username: string) =>
      `确定要删除管理员「${username}」吗？`,
    tableIndex: "序号",
    tableUsername: "用户名",
    tableEmail: "邮箱",
    tableCreatedAt: "注册时间",
    tableActions: "操作",
    btnUnsetAdmin: "设为普通用户",
    btnDelete: "删除",
  },
  orders: {
    title: "用户订单截图",
    adminLabelPrefix: "当前管理员：",
    backToHome: "返回管理员首页",
    emptyText: "暂无订单截图。",
    fetchFailed: "获取订单截图失败",
    tableIndex: "序号",
    tableUserEmail: "用户邮箱",
    tableDeviceId: "设备 ID",
    tableImage: "订单截图",
    tableNote: "备注",
    tableCreatedAt: "上传时间",
  },
  logs: {
    title: "日志",
    desc: "打开日志系统查看最近的错误、告警与运行日志（通常需要已登录 Sentry 后才能访问）。",
    openLogs: "打开日志系统",
    urlLabel: "当前配置：",
    urlNotConfigured: "未配置日志系统地址。",
    configureHint:
      "请在构建/运行环境中设置 NEXT_PUBLIC_ADMIN_LOGS_URL（例如指向 Sentry Logs 页面）。",
  },
  notifications: {
    title: "发送通知",
    desc: "向所有用户广播站内通知（用户端右上角 🔔 可接收并标记已读）。",
    scopeLabel: "发送范围",
    scopeValueAll: "全部用户（广播）",
    scopeFieldLabel: "范围",
    scopeAllUsers: "全部用户",
    scopeVipUsers: "仅 VIP 用户",
    scopeNonVipUsers: "仅非 VIP 用户",
    scopeAdmins: "仅管理员用户",
    scopeEmailList: "指定邮箱列表",
    audienceFieldLabel: "语言投放",
    audienceTooltip: "中文界面只提醒中文投放；英文界面只提醒英文投放。both 表示两边都提醒。",
    audienceBoth: "双语投放（both）",
    audienceZhOnly: "仅中文投放（zh）",
    audienceEnOnly: "仅英文投放（en）",
    targetEmailsLabel: "目标邮箱（每行一个 / 逗号分隔）",
    targetEmailsRequired: "请输入至少一个邮箱",
    targetEmailsPlaceholder: "user1@example.com\nuser2@example.com",
    levelLabel: "等级",
    levelInfo: "信息",
    levelWarn: "警告",
    levelCritical: "严重",
    typeLabel: "类型（可选）",
    typeTooltip: "默认 admin_message",
    titleZhLabel: "标题（中文 zh-CN）",
    titleZhPlaceholder: "例如：系统维护通知",
    bodyZhLabel: "内容（中文 zh-CN）",
    bodyZhPlaceholder: "请输入通知内容（纯文本）",
    titleEnLabel: "Title (English en-US)",
    titleEnPlaceholder: "e.g. Maintenance notice",
    bodyEnLabel: "Body (English en-US)",
    bodyEnPlaceholder: "Enter notification content (plain text)",
    linkUrlLabel: "跳转链接（可选）",
    linkUrlPlaceholder: "例如：/profile 或 https://example.com",
    sendButton: "发送通知",
    resetButton: "重置",
    errorTitleRequired: "请填写通知标题",
    errorBodyRequired: "请填写通知内容",
    successSent: "通知已发送",
  },
  notificationsHistory: {
    title: "历史通知",
    desc: "管理员发送记录（事件日志）。删除后会隐藏用户端对应通知。",
    filterSearchLabel: "搜索",
    filterSearchPlaceholder: "标题/内容包含...",
    filterTypeLabel: "类型",
    filterTypePlaceholder: "admin_message",
    filterLevelLabel: "等级",
    filterLevelAll: "全部",
    filterLevelInfo: "信息",
    filterLevelWarn: "警告",
    filterLevelCritical: "严重",
    filterStatusLabel: "状态",
    filterStatusAll: "全部",
    filterStatusSending: "发送中",
    filterStatusSent: "已发送",
    filterStatusFailed: "失败",
    applyButton: "应用",
    resetButton: "重置",
    tableId: "ID",
    tableLevel: "等级",
    tableType: "类型",
    tableTitle: "标题（中/英）",
    tableStatus: "状态",
    tableCreatedAt: "创建时间",
    tableActions: "操作",
    actionView: "查看",
    actionEditResend: "编辑并重发",
    actionDelete: "删除",
    deleteConfirmTitle: "删除该通知，并隐藏用户端对应通知？",
    deleteOkText: "删除",
    modalTitle: (id: number) => `通知事件 #${id}`,
    modalClose: "关闭",
    modalCreated: "创建时间",
    modalError: "错误原因",
    modalNoLink: "无链接",
    tagLevelInfo: "信息",
    tagLevelWarn: "警告",
    tagLevelCritical: "严重",
    tagStatusSending: "发送中",
    tagStatusSent: "已发送",
    tagStatusFailed: "失败",
    totalText: (total: number) => `共 ${total} 条`,
  },
};

const enUS: AdminMessages = {
  common: {
    adminLoginRequired: "No admin session detected. Please sign in to the admin console.",
    goAdminLogin: "Go to admin login",
    loading: "Loading...",
    unknownError: "Unknown error occurred",
  },
  layout: {
    brand: "Skydimo Admin",
    navHome: "Dashboard",
    navProfile: "Profile",
    navAdmins: "Admins",
    navUsers: "Users",
    navOrders: "Orders",
    navNotifications: "Notifications",
    navNotificationsSend: "Send",
    navNotificationsHistory: "History",
    navLogs: "Logs",
    roleSuperAdmin: "Super Admin",
    roleAdmin: "Admin",
    unauthTitle: "Admin Console",
    unauthDesc: "No admin session detected. Please sign in first.",
    unauthLoginLink: "Sign in",
    searchPlaceholder: "Search features / Ctrl + K",
    searchNotFound: "No matching feature found. Try: ",
    searchNotFoundHint: "Users / Admins / Notifications / Profile / Logs / Home",
    userMenuNameFallback: "Admin",
    userMenuProfile: "Profile",
    userMenuLogout: "Sign out",
  },
  home: {
    title: "Admin Console",
    welcomeLabel: "Welcome, ",
    emailLabel: "Email: ",
  },
  profile: {
    title: "Admin Profile",
    avatarNone: "No avatar",
    currentEmail: "Email",
    username: "Username",
    editUsername: "Edit",
    setAvatar: "Set avatar",
    changeAvatar: "Change avatar",
    avatarDialogTitle: "Set avatar",
    avatarDialogDesc:
      "You can upload a local image or enter an image URL. Leave empty to clear the avatar.",
    avatarDialogCancel: "Cancel",
    avatarDialogSave: "Save",
    usernameDialogTitle: "Edit username",
    usernameDialogCancel: "Cancel",
    usernameDialogSave: "Save",
    updateInfo: "Update info",
    finishUpdateInfo: "Finish editing",
    emailSectionTitle: "Change email",
    emailSectionEdit: "Edit",
    emailDialogTitle: "Confirm email change",
    emailDialogDesc:
      "To change your email, verify the code sent to the new email. After changing, please log in again with the new email.",
    emailNewPlaceholder: "New email",
    emailCodePlaceholder: "Verification code",
    emailSendCode: "Send code",
    emailSendingCode: "Sending...",
    emailDialogCancel: "Cancel",
    emailDialogConfirm: "Confirm",
    errorProfileLoadFailed: "Failed to load profile",
    errorUsernameUpdateFailed: "Failed to update username",
    errorAvatarUpdateFailed: "Failed to update avatar",
    errorNewEmailRequired: "Please enter the new email first",
    errorSendCodeFailed: "Failed to send verification code",
    errorUpdateEmailFieldsRequired:
      "Please enter the new email and the verification code",
    errorUpdateEmailFailed: "Failed to change email",
    errorAvatarTooLarge: "Avatar image size must be within 2MB",
    successUsernameUpdated: "Username updated",
    successAvatarUpdated: "Avatar updated",
    successCodeSent: "Verification code has been sent to the new email",
    successEmailUpdated: "Email updated, please login with the new email",
  },
  users: {
    title: "User Management",
    adminLabelPrefix: "Current admin: ",
    backToHome: "Back to admin home",
    searchPlaceholder: "Search by username or email",
    searchButton: "Search",
    resetButton: "Reset",
    emptyText: "No users.",
    fetchFailed: "Failed to load users",
    actionFailed: "Operation failed",
    setVipPrompt: (currentDate: string) =>
      `Enter VIP expiration date (YYYY-MM-DD), leave blank to remove VIP: ${currentDate}`,
    setVipFailed: "Failed to update VIP status",
    tableIndex: "#",
    tableUsername: "Username",
    tableEmail: "Email",
    tableRole: "Role",
    tableVipStatus: "VIP status",
    tableVipExpiresAt: "VIP expiry",
    tableCreatedAt: "Created at",
    tableActions: "Actions",
    roleUser: "User",
    roleAdmin: "Admin",
    vipOn: "VIP",
    vipOff: "Non-VIP",
    btnSetVip: "Set VIP",
    btnSetAdmin: "Make admin",
    btnDelete: "Delete",
    deleteConfirm: (username: string) =>
      `Are you sure you want to delete user "${username}"?`,
    pagerPrev: "Prev",
    pagerNext: "Next",
    pagerText: (page, totalPages, totalUsers) =>
      `Page ${page} / ${totalPages} (total ${totalUsers} users)`,
  },
  admins: {
    title: "Admins",
    unauthorizedDesc:
      "Current account is not a super admin and cannot access this page.",
    limitTip: "At most 15 admins are allowed.",
    emptyText: "No admins yet.",
    fetchFailed: "Failed to load admins",
    actionFailed: "Operation failed",
    deleteConfirm: (username: string) =>
      `Are you sure you want to delete admin "${username}"?`,
    tableIndex: "#",
    tableUsername: "Username",
    tableEmail: "Email",
    tableCreatedAt: "Created at",
    tableActions: "Actions",
    btnUnsetAdmin: "Make regular user",
    btnDelete: "Delete",
  },
  orders: {
    title: "User Order Screenshots",
    adminLabelPrefix: "Current admin: ",
    backToHome: "Back to admin home",
    emptyText: "No order screenshots yet.",
    fetchFailed: "Failed to load order screenshots",
    tableIndex: "#",
    tableUserEmail: "User email",
    tableDeviceId: "Device ID",
    tableImage: "Screenshot",
    tableNote: "Note",
    tableCreatedAt: "Created at",
  },
  logs: {
    title: "Logs",
    desc:
      "Open the log system to view recent errors, alerts, and runtime logs (usually requires being signed in to Sentry).",
    openLogs: "Open log system",
    urlLabel: "Configured URL: ",
    urlNotConfigured: "Log system URL is not configured.",
    configureHint:
      "Set NEXT_PUBLIC_ADMIN_LOGS_URL in your build/runtime environment (e.g. the Sentry Logs page).",
  },
  notifications: {
    title: "Send notification",
    desc: "Broadcast an in-app notification to all users (users receive it via the 🔔 bell).",
    scopeLabel: "Scope",
    scopeValueAll: "All users (broadcast)",
    scopeFieldLabel: "Scope",
    scopeAllUsers: "All users",
    scopeVipUsers: "VIP users only",
    scopeNonVipUsers: "Non-VIP users only",
    scopeAdmins: "Admins only",
    scopeEmailList: "Email list",
    audienceFieldLabel: "Audience language",
    audienceTooltip:
      "Chinese UI only notifies zh audience; English UI only notifies en audience. both notifies both sides.",
    audienceBoth: "Both (both)",
    audienceZhOnly: "Chinese only (zh)",
    audienceEnOnly: "English only (en)",
    targetEmailsLabel: "Target emails (one per line / comma-separated)",
    targetEmailsRequired: "Please enter at least one email",
    targetEmailsPlaceholder: "user1@example.com\nuser2@example.com",
    levelLabel: "Level",
    levelInfo: "Info",
    levelWarn: "Warning",
    levelCritical: "Critical",
    typeLabel: "Type (optional)",
    typeTooltip: "Defaults to admin_message",
    titleZhLabel: "Title (Chinese zh-CN)",
    titleZhPlaceholder: "e.g. 系统维护通知",
    bodyZhLabel: "Body (Chinese zh-CN)",
    bodyZhPlaceholder: "请输入通知内容（纯文本）",
    titleEnLabel: "Title (English en-US)",
    titleEnPlaceholder: "e.g. Maintenance notice",
    bodyEnLabel: "Body (English en-US)",
    bodyEnPlaceholder: "Enter notification content (plain text)",
    linkUrlLabel: "Link URL (optional)",
    linkUrlPlaceholder: "e.g. /profile or https://example.com",
    sendButton: "Send",
    resetButton: "Reset",
    errorTitleRequired: "Please enter a title",
    errorBodyRequired: "Please enter a body",
    successSent: "Notification sent",
  },
  notificationsHistory: {
    title: "History",
    desc: "Admin notification events (send log). Deleting hides related user notifications.",
    filterSearchLabel: "Search",
    filterSearchPlaceholder: "title/body contains...",
    filterTypeLabel: "Type",
    filterTypePlaceholder: "admin_message",
    filterLevelLabel: "Level",
    filterLevelAll: "All",
    filterLevelInfo: "Info",
    filterLevelWarn: "Warn",
    filterLevelCritical: "Critical",
    filterStatusLabel: "Status",
    filterStatusAll: "All",
    filterStatusSending: "Sending",
    filterStatusSent: "Sent",
    filterStatusFailed: "Failed",
    applyButton: "Apply",
    resetButton: "Reset",
    tableId: "ID",
    tableLevel: "Level",
    tableType: "Type",
    tableTitle: "Title (zh/en)",
    tableStatus: "Status",
    tableCreatedAt: "Created",
    tableActions: "Actions",
    actionView: "View",
    actionEditResend: "Edit & resend",
    actionDelete: "Delete",
    deleteConfirmTitle: "Delete this event and hide related user notifications?",
    deleteOkText: "Delete",
    modalTitle: (id: number) => `Event #${id}`,
    modalClose: "Close",
    modalCreated: "Created",
    modalError: "Error",
    modalNoLink: "No link",
    tagLevelInfo: "INFO",
    tagLevelWarn: "WARN",
    tagLevelCritical: "CRITICAL",
    tagStatusSending: "SENDING",
    tagStatusSent: "SENT",
    tagStatusFailed: "FAILED",
    totalText: (total: number) => `Total ${total}`,
  },
};

export function getAdminMessages(lang: AppLanguage): AdminMessages {
  if (lang === "en-US") return enUS;
  return zhCN;
}


