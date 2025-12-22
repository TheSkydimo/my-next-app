export type OfficialNicknameLanguage = "zh-CN" | "en-US";

/**
 * 管理端对外“公开昵称”统一规则：
 * - 中文区：官方
 * - 英文区：official
 */
export function getOfficialPublicNickname(lang: OfficialNicknameLanguage): string {
  return lang === "en-US" ? "official" : "官方";
}


