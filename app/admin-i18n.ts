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
    passwordSectionTitle: string;
    passwordSectionEdit: string;
    emailSectionTitle: string;
    emailSectionEdit: string;
    passwordDialogTitle: string;
    passwordOldPlaceholder: string;
    passwordNewPlaceholder: string;
    passwordConfirmPlaceholder: string;
    passwordDialogCancel: string;
    passwordDialogConfirm: string;
    emailDialogTitle: string;
    emailDialogDesc: string;
    emailNewPlaceholder: string;
    emailCodePlaceholder: string;
    emailSendCode: string;
    emailSendingCode: string;
    emailOldPasswordPlaceholder: string;
    emailNewPasswordPlaceholder: string;
    emailConfirmNewPasswordPlaceholder: string;
    emailDialogCancel: string;
    emailDialogConfirm: string;
    errorProfileLoadFailed: string;
    errorUsernameUpdateFailed: string;
    errorAvatarUpdateFailed: string;
    errorPasswordFieldsRequired: string;
    errorPasswordNotMatch: string;
    errorPasswordUpdateFailed: string;
    errorNewEmailRequired: string;
    errorSendCodeFailed: string;
    errorUpdateEmailFieldsRequired: string;
    errorUpdateEmailPasswordFieldsRequired: string;
    errorUpdateEmailPasswordNotMatch: string;
    errorUpdateEmailFailed: string;
    errorAvatarTooLarge: string;
    successUsernameUpdated: string;
    successAvatarUpdated: string;
    successPasswordUpdated: string;
    successCodeSent: string;
    successEmailUpdated: string;
    showPassword: string;
    hidePassword: string;
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
    roleSuperAdmin: "超级管理员",
    roleAdmin: "管理员",
    unauthTitle: "管理后台",
    unauthDesc: "未检测到管理员登录，请先登录。",
    unauthLoginLink: "去登录",
    searchPlaceholder: "搜索功能 / Ctrl + K",
    searchNotFound: "未找到相关功能，请尝试：",
    searchNotFoundHint: "用户 / 管理员 / 信息 / 首页",
    userMenuNameFallback: "管理员",
    userMenuProfile: "个人中心",
    userMenuLogout: "退出登录",
  },
  profile: {
    title: "管理员信息",
    avatarNone: "无头像",
    currentEmail: "当前邮箱：",
    username: "用户名：",
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
    passwordSectionTitle: "修改密码",
    passwordSectionEdit: "修改",
    emailSectionTitle: "修改邮箱",
    emailSectionEdit: "修改",
    passwordDialogTitle: "修改密码",
    passwordOldPlaceholder: "旧密码",
    passwordNewPlaceholder: "新密码",
    passwordConfirmPlaceholder: "确认新密码",
    passwordDialogCancel: "取消",
    passwordDialogConfirm: "确认修改",
    emailDialogTitle: "确认修改邮箱",
    emailDialogDesc: "修改邮箱时会同时更新登录密码，请先验证新邮箱并设置新密码。",
    emailNewPlaceholder: "新邮箱",
    emailCodePlaceholder: "邮箱验证码",
    emailSendCode: "获取验证码",
    emailSendingCode: "发送中...",
    emailOldPasswordPlaceholder: "旧密码",
    emailNewPasswordPlaceholder: "新密码",
    emailConfirmNewPasswordPlaceholder: "确认新密码",
    emailDialogCancel: "取消",
    emailDialogConfirm: "确认修改",
    errorProfileLoadFailed: "获取个人信息失败",
    errorUsernameUpdateFailed: "更新用户名失败",
    errorAvatarUpdateFailed: "更新头像失败",
    errorPasswordFieldsRequired: "请完整填写旧密码和新密码",
    errorPasswordNotMatch: "两次输入的新密码不一致",
    errorPasswordUpdateFailed: "修改密码失败",
    errorNewEmailRequired: "请先填写新邮箱",
    errorSendCodeFailed: "发送验证码失败",
    errorUpdateEmailFieldsRequired: "请填写新邮箱和邮箱验证码",
    errorUpdateEmailPasswordFieldsRequired:
      "请在弹出的对话框中填写旧密码和新密码",
    errorUpdateEmailPasswordNotMatch: "两次输入的新密码不一致",
    errorUpdateEmailFailed: "修改邮箱失败",
    errorAvatarTooLarge: "头像图片大小请控制在 300KB 以内",
    successUsernameUpdated: "用户名已更新",
    successAvatarUpdated: "头像已更新",
    successPasswordUpdated: "密码已修改",
    successCodeSent: "验证码已发送到新邮箱，请注意查收",
    successEmailUpdated: "邮箱已修改，请使用新邮箱登录",
    showPassword: "显示",
    hidePassword: "隐藏",
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
    roleSuperAdmin: "Super Admin",
    roleAdmin: "Admin",
    unauthTitle: "Admin Console",
    unauthDesc: "No admin session detected. Please sign in first.",
    unauthLoginLink: "Sign in",
    searchPlaceholder: "Search features / Ctrl + K",
    searchNotFound: "No matching feature found. Try: ",
    searchNotFoundHint: "Users / Admins / Profile / Home",
    userMenuNameFallback: "Admin",
    userMenuProfile: "Profile",
    userMenuLogout: "Sign out",
  },
  profile: {
    title: "Admin Profile",
    avatarNone: "No avatar",
    currentEmail: "Current email: ",
    username: "Username: ",
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
    passwordSectionTitle: "Change password",
    passwordSectionEdit: "Edit",
    emailSectionTitle: "Change email",
    emailSectionEdit: "Edit",
    passwordDialogTitle: "Change password",
    passwordOldPlaceholder: "Current password",
    passwordNewPlaceholder: "New password",
    passwordConfirmPlaceholder: "Confirm new password",
    passwordDialogCancel: "Cancel",
    passwordDialogConfirm: "Confirm",
    emailDialogTitle: "Confirm email change",
    emailDialogDesc:
      "When changing your email, your login password will be updated as well. Verify the new email and set a new password.",
    emailNewPlaceholder: "New email",
    emailCodePlaceholder: "Verification code",
    emailSendCode: "Send code",
    emailSendingCode: "Sending...",
    emailOldPasswordPlaceholder: "Current password",
    emailNewPasswordPlaceholder: "New password",
    emailConfirmNewPasswordPlaceholder: "Confirm new password",
    emailDialogCancel: "Cancel",
    emailDialogConfirm: "Confirm",
    errorProfileLoadFailed: "Failed to load profile",
    errorUsernameUpdateFailed: "Failed to update username",
    errorAvatarUpdateFailed: "Failed to update avatar",
    errorPasswordFieldsRequired:
      "Please fill in the current password and the new password",
    errorPasswordNotMatch: "The two new passwords do not match",
    errorPasswordUpdateFailed: "Failed to change password",
    errorNewEmailRequired: "Please enter the new email first",
    errorSendCodeFailed: "Failed to send verification code",
    errorUpdateEmailFieldsRequired:
      "Please enter the new email and the verification code",
    errorUpdateEmailPasswordFieldsRequired:
      "Please fill in the current and new password in the dialog",
    errorUpdateEmailPasswordNotMatch: "The two new passwords do not match",
    errorUpdateEmailFailed: "Failed to change email",
    errorAvatarTooLarge: "Avatar image size must be within 300KB",
    successUsernameUpdated: "Username updated",
    successAvatarUpdated: "Avatar updated",
    successPasswordUpdated: "Password changed",
    successCodeSent: "Verification code has been sent to the new email",
    successEmailUpdated: "Email updated, please login with the new email",
    showPassword: "Show",
    hidePassword: "Hide",
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
};

export function getAdminMessages(lang: AppLanguage): AdminMessages {
  if (lang === "en-US") return enUS;
  return zhCN;
}


