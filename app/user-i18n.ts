"use client";

import type { AppLanguage } from "./client-prefs";

export type UserMessages = {
  common: {
    loginRequired: string;
    goLogin: string;
    loading: string;
    unknownError: string;
  };
  home: {
    welcomeTitle: (name: string) => string;
    currentEmailPrefix: string;
    guestTitle: string;
    guestSubtitle: string;
    loginButton: string;
    registerButton: string;
  };
  layout: {
    navHome: string;
    navProfile: string;
    navDevices: string;
    logout: string;
    searchPlaceholder: string;
    searchNotFound: string;
    searchNotFoundHint: string;
    brand: string;
  };
  devices: {
    title: string;
    subtitle: string;
    addSectionTitle: string;
    addSectionDesc: string;
    inputPlaceholder: string;
    addButton: string;
    addEmptyError: string;
    addFailed: string;
    addSuccess: string;
    listTitle: string;
    listSubtitle: string;
    emptyText: string;
    warrantyLabel: string;
    deleteButton: string;
    deleteConfirm: (deviceId: string) => string;
    deleteFailed: string;
    deleteSuccess: string;
    pagerText: (total: number, page: number, maxPage: number) => string;
    fetchFailed: string;
    orderNotePlaceholder: string;
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
};

const zhCN: UserMessages = {
  common: {
    loginRequired: "未检测到用户登录，请先登录。",
    goLogin: "去登录",
    loading: "加载中...",
    unknownError: "发生未知错误",
  },
  home: {
    welcomeTitle: (name: string) => `欢迎，${name}！`,
    currentEmailPrefix: "当前登录邮箱：",
    guestTitle: "欢迎来到Skydimo用户管理系统",
    guestSubtitle: "你还没有登录，请先登录或注册。",
    loginButton: "去登录",
    registerButton: "去注册",
  },
  layout: {
    navHome: "首页",
    navProfile: "信息管理",
    navDevices: "设备信息管理",
    logout: "退出",
    searchPlaceholder: "搜索功能 / Ctrl + K",
    searchNotFound: "未找到相关功能，请尝试：",
    searchNotFoundHint: "首页 / 信息 / 设备",
    brand: "Skydimo",
  },
  devices: {
    title: "设备信息管理",
    subtitle: "管理并查看与你账号绑定的设备信息。",
    addSectionTitle: "添加设备",
    addSectionDesc:
      "输入设备 ID 并点击“添加设备”，系统会自动为你记录并计算质保到期时间。",
    inputPlaceholder: "请输入设备 ID",
    addButton: "添加设备",
    addEmptyError: "请输入设备 ID",
    addFailed: "添加设备失败",
    addSuccess: "设备已添加",
    listTitle: "我的设备列表",
    listSubtitle: "查看当前账号下已登记的全部设备及对应的质保到期时间。",
    emptyText: "当前没有已登记的设备。",
    warrantyLabel: "质保到期时间：",
    deleteButton: "删除设备",
    deleteConfirm: (deviceId: string) =>
      `确定要删除设备 ${deviceId} 吗？删除后将无法恢复。`,
    deleteFailed: "删除设备失败",
    deleteSuccess: "设备已删除",
    pagerText: (total, page, maxPage) =>
      `共 ${total} 台设备，当前第 ${page} / ${maxPage} 页`,
    fetchFailed: "获取设备信息失败",
    orderNotePlaceholder: "可选备注，例如订单号、平台（淘宝/京东等）",
  },
  profile: {
    title: "个人信息",
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
};

const enUS: UserMessages = {
  common: {
    loginRequired: "No logged-in user detected. Please sign in first.",
    goLogin: "Go to Login",
    loading: "Loading...",
    unknownError: "Unknown error occurred",
  },
  home: {
    welcomeTitle: (name: string) => `Welcome, ${name}!`,
    currentEmailPrefix: "Signed in as: ",
    guestTitle: "Welcome to the Skydimo User Center",
    guestSubtitle:
      "You are not signed in yet. Please sign in or create an account.",
    loginButton: "Sign in",
    registerButton: "Sign up",
  },
  layout: {
    navHome: "Home",
    navProfile: "Profile",
    navDevices: "Devices",
    logout: "Sign out",
    searchPlaceholder: "Search features / Ctrl + K",
    searchNotFound: "No matching feature found. Try:",
    searchNotFoundHint: "Home / Profile / Devices",
    brand: "Skydimo",
  },
  devices: {
    title: "Device Management",
    subtitle: "Manage and view devices that are bound to your account.",
    addSectionTitle: "Add Device",
    addSectionDesc:
      "Enter the device ID and click “Add Device”. The system will record it and calculate the warranty expiration time.",
    inputPlaceholder: "Enter device ID",
    addButton: "Add Device",
    addEmptyError: "Please enter a device ID",
    addFailed: "Failed to add device",
    addSuccess: "Device added",
    listTitle: "My Devices",
    listSubtitle:
      "View all registered devices under the current account and their warranty expiration times.",
    emptyText: "No registered devices.",
    warrantyLabel: "Warranty expires at: ",
    deleteButton: "Remove Device",
    deleteConfirm: (deviceId: string) =>
      `Remove device ${deviceId}? This action cannot be undone.`,
    deleteFailed: "Failed to delete device",
    deleteSuccess: "Device removed",
    pagerText: (total, page, maxPage) =>
      `Total ${total} devices, page ${page} of ${maxPage}`,
    fetchFailed: "Failed to load devices",
    orderNotePlaceholder: "Optional note, e.g. order number or platform",
  },
  profile: {
    title: "Profile",
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
};

export function getUserMessages(lang: AppLanguage): UserMessages {
  if (lang === "en-US") return enUS;
  return zhCN;
}


