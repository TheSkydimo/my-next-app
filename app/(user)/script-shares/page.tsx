"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getUserMessages } from "../../user-i18n";
import { useUser } from "../../contexts/UserContext";

type ShareItem = {
  id: string;
  effectName: string;
  publicUsername: string;
  isPublic?: boolean;
  originalFilename: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  canManage?: boolean;
};

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function isSkmodeFile(file: File | null): boolean {
  if (!file) return false;
  return file.name.toLowerCase().endsWith(".skmode");
}

function basenameWithoutExt(filename: string, extLower: string): string {
  const name = String(filename ?? "");
  const lower = name.toLowerCase();
  if (lower.endsWith(extLower)) {
    return name.slice(0, Math.max(0, name.length - extLower.length));
  }
  const lastDot = name.lastIndexOf(".");
  return lastDot > 0 ? name.slice(0, lastDot) : name;
}

function ShareCard({
  item,
  language,
  canManage,
  onDelete,
  onReupload,
}: {
  item: ShareItem;
  language: AppLanguage;
  canManage: boolean;
  onDelete?: (id: string) => void;
  onReupload?: (id: string, file: File) => void;
}) {
  const downloadUrl = `/api/script-shares/${encodeURIComponent(item.id)}/download`;
  return (
    <div className="script-share-card">
      <div className="script-share-card__top">
        <div className="script-share-card__title" title={item.effectName}>
          {item.effectName}
        </div>
        <div className="script-share-card__meta">
          <span className="script-share-card__pill" title={item.publicUsername}>
            {language === "zh-CN" ? "作者：" : "By: "}
            {item.publicUsername}
          </span>
          {canManage && item.isPublic === false && (
            <span className="script-share-card__pill script-share-card__pill--private">
              {language === "zh-CN" ? "私密" : "Private"}
            </span>
          )}
          <span className="script-share-card__pill" title={item.originalFilename}>
            {item.originalFilename}
          </span>
          <span className="script-share-card__pill">
            {formatBytes(item.sizeBytes)}
          </span>
          <span className="script-share-card__time">
            {language === "zh-CN" ? "更新：" : "Updated: "}
            {new Date(item.updatedAt || item.createdAt).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="script-share-card__actions">
        <a className="script-share-card__btn script-share-card__btn--primary" href={downloadUrl}>
          {language === "zh-CN" ? "下载" : "Download"}
        </a>

        {canManage && (
          <>
            <label className="script-share-card__btn script-share-card__btn--secondary">
              {language === "zh-CN" ? "重新上传" : "Re-upload"}
              <input
                type="file"
                accept=".skmode"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  e.currentTarget.value = "";
                  if (!f) return;
                  onReupload?.(item.id, f);
                }}
              />
            </label>
            <button
              type="button"
              className="script-share-card__btn script-share-card__btn--danger"
              onClick={() => onDelete?.(item.id)}
            >
              {language === "zh-CN" ? "移除" : "Remove"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ScriptSharesPage() {
  const userContext = useUser();
  const isUserInitialized = userContext.initialized;
  const hasUser = !!userContext.profile?.email;
  const currentUsername = userContext.profile?.username ?? null;

  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const messages = getUserMessages(language);

  const [viewTab, setViewTab] = useState<"mine" | "all">("mine");
  const [effectName, setEffectName] = useState("");
  const [publicUsername, setPublicUsername] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [mine, setMine] = useState<ShareItem[]>([]);
  const [all, setAll] = useState<ShareItem[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const initialLang = getInitialLanguage();
    setLanguage(initialLang);

    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ language: AppLanguage }>;
      if (custom.detail?.language) setLanguage(custom.detail.language);
    };

    window.addEventListener("app-language-changed", handler as EventListener);
    return () => {
      window.removeEventListener("app-language-changed", handler as EventListener);
    };
  }, []);

  // Hash sync: #mine / #all
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      const hash = window.location.hash;
      if (hash === "#all") setViewTab("all");
      else setViewTab("mine");
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const canSubmit = useMemo(() => {
    const nameOk = effectName.trim().length > 0;
    const nickOk = publicUsername.trim().length > 0;
    return nameOk && nickOk && isSkmodeFile(uploadFile);
  }, [effectName, publicUsername, uploadFile]);

  const loadMine = async () => {
    setLoadingMine(true);
    try {
      const res = await fetch("/api/user/script-shares?page=1&pageSize=50", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { items?: ShareItem[] };
      setMine(data.items ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingMine(false);
    }
  };

  const loadAll = async () => {
    setLoadingAll(true);
    try {
      const res = await fetch("/api/script-shares?page=1&pageSize=50");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { items?: ShareItem[] };
      setAll(data.items ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingAll(false);
    }
  };

  useEffect(() => {
    if (!hasUser) return;
    void loadMine();
  }, [hasUser]);

  useEffect(() => {
    void loadAll();
  }, []);

  // 默认昵称：使用当前登录用户的用户名（可编辑覆盖）
  useEffect(() => {
    if (!hasUser) return;
    if (publicUsername.trim()) return;
    if (currentUsername && currentUsername.trim()) {
      setPublicUsername(currentUsername.trim());
    }
  }, [hasUser, currentUsername, publicUsername]);

  const submitUpload = async () => {
    setError("");
    setOkMsg("");
    if (!uploadFile) {
      setError(language === "zh-CN" ? "请先选择 .skmode 文件" : "Please select a .skmode file first.");
      return;
    }
    if (!effectName.trim()) {
      setError(language === "zh-CN" ? "请填写脚本效果名字" : "Please enter effect name.");
      return;
    }
    if (!publicUsername.trim()) {
      setError(language === "zh-CN" ? "请填写公开展示昵称" : "Please enter public nickname.");
      return;
    }
    if (!isSkmodeFile(uploadFile)) {
      setError(language === "zh-CN" ? "只允许上传 .skmode 文件" : "Only .skmode files are allowed");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("effectName", effectName.trim());
      form.append("publicUsername", publicUsername.trim());
      form.append("isPublic", isPublic ? "1" : "0");
      form.append("file", uploadFile);

      const res = await fetch("/api/user/script-shares", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || (language === "zh-CN" ? "上传失败" : "Upload failed"));
      }
      const created = (await res.json()) as ShareItem;
      setMine((prev) => [created, ...prev]);
      setOkMsg(
        isPublic
          ? language === "zh-CN"
            ? "上传成功，已公开展示"
            : "Uploaded and published"
          : language === "zh-CN"
            ? "上传成功（私密，仅自己可见）"
            : "Uploaded (private, only visible to you)"
      );
      setEffectName("");
      setPublicUsername("");
      setUploadFile(null);
      void loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : (language === "zh-CN" ? "上传失败" : "Upload failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm(language === "zh-CN" ? "确定要移除该脚本吗？" : "Remove this script?");
    if (!ok) return;

    setError("");
    setOkMsg("");
    try {
      const res = await fetch(`/api/user/script-shares/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      setMine((prev) => prev.filter((x) => x.id !== id));
      setOkMsg(language === "zh-CN" ? "已移除" : "Removed");
      void loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : (language === "zh-CN" ? "移除失败" : "Remove failed"));
    }
  };

  const handleReupload = async (id: string, file: File) => {
    setError("");
    setOkMsg("");
    if (!isSkmodeFile(file)) {
      setError(language === "zh-CN" ? "只允许上传 .skmode 文件" : "Only .skmode files are allowed");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`/api/user/script-shares/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: form,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      setOkMsg(language === "zh-CN" ? "已重新上传" : "Re-uploaded");
      void loadMine();
      void loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : (language === "zh-CN" ? "重新上传失败" : "Re-upload failed"));
    }
  };

  if (!isUserInitialized) {
    return (
      <div className="vben-page">
        <p>{messages.common.loading}</p>
      </div>
    );
  }

  if (!hasUser) {
    return (
      <div className="vben-page">
        <p>{messages.common.loginRequired}</p>
        <Link href="/login">{messages.common.goLogin}</Link>
      </div>
    );
  }

  const getPageTitle = () => {
    if (viewTab === "all") {
      return language === "zh-CN" ? "查看分享" : "Browse shares";
    }
    // viewTab === "mine"
    return language === "zh-CN" ? "我的分享" : "My shares";
  };

  const getPageSubtitle = () => {
    if (viewTab === "all") {
      return language === "zh-CN"
        ? "这里展示所有公开的Skydimo专用脚本，你可以直接下载使用。"
        : "Browse all public Skydimo-only scripts and download them.";
    }
    // viewTab === "mine"
    return language === "zh-CN"
      ? "上传Skydimo专用脚本（仅支持 .skmode），可选择公开或私密：公开后其他用户可查看/下载；私密仅自己可见。"
      : "Upload Skydimo-only scripts (.skmode). You can choose Public or Private: public scripts are visible/downloadable; private scripts are only visible to you.";
  };

  return (
    <div className="vben-page">
      <div className="vben-page__header">
        <h1 className="vben-page__title">
          {getPageTitle()}
        </h1>
        <p className="vben-page__subtitle">
          {getPageSubtitle()}
        </p>
      </div>

      {okMsg && <p style={{ marginTop: 12, color: "green" }}>{okMsg}</p>}
      {error && <p style={{ marginTop: 12, color: "red" }}>{error}</p>}

      {viewTab === "mine" && (
        <section id="mine" style={{ marginTop: 18 }}>
          <div className="user-page-card">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  placeholder={language === "zh-CN" ? "脚本效果名字（必填）" : "Effect name (required)"}
                  value={effectName}
                  onChange={(e) => setEffectName(e.target.value)}
                  style={{ flex: 1, minWidth: 220 }}
                />
                <input
                  placeholder={language === "zh-CN" ? "公开展示昵称（必填）" : "Public nickname (required)"}
                  value={publicUsername}
                  onChange={(e) => setPublicUsername(e.target.value)}
                  style={{ flex: 1, minWidth: 200 }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  {/* hidden file input */}
                  <input
                    id="script-share-file-input"
                    type="file"
                    accept=".skmode"
                    style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0 }}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.currentTarget.value = "";
                      setUploadFile(f);
                      if (f && !isSkmodeFile(f)) {
                        setError(
                          language === "zh-CN"
                            ? "只允许上传 .skmode 文件"
                            : "Only .skmode files are allowed"
                        );
                      } else {
                        setError("");
                      }
                      // 默认脚本效果名：从文件名推导（去掉 .skmode），且只在当前为空时自动填写
                      if (f && isSkmodeFile(f) && !effectName.trim()) {
                        const base = basenameWithoutExt(f.name, ".skmode").trim();
                        if (base) setEffectName(base);
                      }
                    }}
                  />

                  <button
                    type="button"
                    className="script-share-upload-btn script-share-upload-btn--secondary"
                    onClick={() => {
                      const el = document.getElementById("script-share-file-input") as HTMLInputElement | null;
                      el?.click();
                    }}
                  >
                    {language === "zh-CN" ? "选择我的脚本" : "Select my script"}
                  </button>

                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    {uploadFile
                      ? uploadFile.name
                      : language === "zh-CN"
                        ? "未选择任何文件"
                        : "No file selected"}
                  </span>

                  <button
                    type="button"
                    className="script-share-upload-btn script-share-upload-btn--primary"
                    disabled={submitting}
                    onClick={submitUpload}
                  >
                    {submitting
                      ? language === "zh-CN"
                        ? "上传中..."
                        : "Uploading..."
                      : language === "zh-CN"
                        ? "上传"
                        : "Upload"}
                  </button>
                </div>

                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#6b7280" }}>
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                  />
                  {language === "zh-CN" ? "公开（所有用户可查看/下载）" : "Public (all users can view/download)"}
                  {!isPublic && (
                    <span style={{ color: "#fbbf24" }}>
                      {language === "zh-CN" ? "（私密：仅自己可见）" : "(Private: only you)"}
                    </span>
                  )}
                </label>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            {loadingMine ? (
              <p>{messages.common.loading}</p>
            ) : mine.length === 0 ? (
              <p style={{ color: "#6b7280" }}>
                {language === "zh-CN" ? "你还没有分享任何脚本。" : "No shares yet."}
              </p>
            ) : (
              <div className="script-share-grid">
                {mine.map((it) => (
                  <ShareCard
                    key={it.id}
                    item={it}
                    language={language}
                    canManage={true}
                    onDelete={handleDelete}
                    onReupload={handleReupload}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {viewTab === "all" && (
        <section id="all" style={{ marginTop: 18 }}>
          {loadingAll ? (
            <p>{messages.common.loading}</p>
          ) : all.length === 0 ? (
            <p style={{ color: "#6b7280" }}>
              {language === "zh-CN" ? "目前还没有公开分享。" : "No public shares yet."}
            </p>
          ) : (
            <div className="script-share-grid">
              {all.map((it) => (
                <ShareCard
                  key={it.id}
                  item={it}
                  language={language}
                  canManage={false}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}


