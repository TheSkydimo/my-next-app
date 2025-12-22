"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getAdminMessages } from "../../admin-i18n";
import { useAdmin } from "../../contexts/AdminContext";

type AdminShareItem = {
  id: string;
  ownerUserId: number;
  ownerUsername: string;
  ownerEmail: string;
  effectName: string;
  publicUsername: string;
  lang?: "zh-CN" | "en-US";
  isPublic: boolean;
  originalFilename: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
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

function basenameWithoutExt(filename: string): string {
  const name = String(filename ?? "");
  const lower = name.toLowerCase();
  if (lower.endsWith(".skmode")) return name.slice(0, Math.max(0, name.length - ".skmode".length));
  const lastDot = name.lastIndexOf(".");
  return lastDot > 0 ? name.slice(0, lastDot) : name;
}

function ShareCard({
  item,
  language,
  onDelete,
  onReupload,
  onTogglePublic,
}: {
  item: AdminShareItem;
  language: AppLanguage;
  onDelete?: (id: string) => void;
  onReupload?: (id: string, file: File) => void;
  onTogglePublic?: (id: string, next: boolean) => void;
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
            {language === "zh-CN" ? "展示昵称：" : "Display: "}
            {item.publicUsername}
          </span>
          {!item.isPublic && (
            <span className="script-share-card__pill script-share-card__pill--private">
              {language === "zh-CN" ? "私密" : "Private"}
            </span>
          )}
          <span className="script-share-card__pill" title={item.ownerEmail}>
            {language === "zh-CN" ? "归属：" : "Owner: "}
            {item.ownerEmail}
          </span>
          <span className="script-share-card__pill" title={item.originalFilename}>
            {item.originalFilename}
          </span>
          <span className="script-share-card__pill">{formatBytes(item.sizeBytes)}</span>
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

        <label className="script-share-card__btn script-share-card__btn--secondary">
          {language === "zh-CN" ? "重传" : "Re-upload"}
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
          className="script-share-card__btn script-share-card__btn--secondary"
          onClick={() => onTogglePublic?.(item.id, !item.isPublic)}
        >
          {language === "zh-CN"
            ? item.isPublic
              ? "设为私密"
              : "设为公开"
            : item.isPublic
              ? "Make private"
              : "Make public"}
        </button>

        <button
          type="button"
          className="script-share-card__btn script-share-card__btn--danger"
          onClick={() => onDelete?.(item.id)}
        >
          {language === "zh-CN" ? "删除" : "Delete"}
        </button>
      </div>
    </div>
  );
}

export default function AdminScriptSharesPage() {
  const adminContext = useAdmin();
  const adminEmail = adminContext.profile?.email ?? null;

  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const messages = getAdminMessages(language);

  const [q, setQ] = useState("");
  const [filterLang, setFilterLang] = useState<"all" | "zh-CN" | "en-US">("all");
  const [items, setItems] = useState<AdminShareItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [effectName, setEffectName] = useState("");
  const [publicUsername, setPublicUsername] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLang, setUploadLang] = useState<"zh-CN" | "en-US">("zh-CN");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const initialLang = getInitialLanguage();
    setLanguage(initialLang);

    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ language: AppLanguage }>;
      if (custom.detail?.language) setLanguage(custom.detail.language);
    };
    window.addEventListener("app-language-changed", handler as EventListener);
    return () => window.removeEventListener("app-language-changed", handler as EventListener);
  }, []);

  const canUpload = useMemo(() => {
    return !!effectName.trim() && !!publicUsername.trim() && isSkmodeFile(uploadFile);
  }, [effectName, publicUsername, uploadFile]);

  const fetchList = async (keyword?: string) => {
    setLoading(true);
    setError("");
    setOkMsg("");
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "50" });
      const kw = (keyword ?? q).trim();
      if (kw) params.set("q", kw);
      params.set("lang", filterLang);
      const res = await fetch(`/api/admin/script-shares?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { items?: AdminShareItem[] };
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : (language === "zh-CN" ? "加载失败" : "Failed to load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminEmail) void fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminEmail, filterLang]);

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
      form.append("lang", uploadLang);
      form.append("file", uploadFile);

      const res = await fetch("/api/admin/script-shares", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());

      setOkMsg(language === "zh-CN" ? "上传成功（默认公开）" : "Uploaded (public)");
      setEffectName("");
      setPublicUsername("");
      setUploadFile(null);
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : (language === "zh-CN" ? "上传失败" : "Upload failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm(language === "zh-CN" ? "确定要删除该脚本吗？" : "Delete this script?");
    if (!ok) return;
    setError("");
    setOkMsg("");
    try {
      const res = await fetch(`/api/admin/script-shares/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      setOkMsg(language === "zh-CN" ? "已删除" : "Deleted");
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : (language === "zh-CN" ? "删除失败" : "Delete failed"));
    }
  };

  const handleReupload = async (id: string, file: File) => {
    setError("");
    setOkMsg("");
    if (!isSkmodeFile(file)) {
      setError(language === "zh-CN" ? "只允许上传 .skmode 文件" : "Only .skmode files are allowed");
      return;
    }
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/admin/script-shares/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: form,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      setOkMsg(language === "zh-CN" ? "已重传" : "Re-uploaded");
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : (language === "zh-CN" ? "重传失败" : "Re-upload failed"));
    }
  };

  const handleTogglePublic = async (id: string, next: boolean) => {
    setError("");
    setOkMsg("");
    try {
      const res = await fetch(`/api/admin/script-shares/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isPublic: next }),
      });
      if (!res.ok) throw new Error(await res.text());
      setOkMsg(
        language === "zh-CN"
          ? next
            ? "已设为公开"
            : "已设为私密"
          : next
            ? "Now public"
            : "Now private"
      );
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, isPublic: next } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : (language === "zh-CN" ? "操作失败" : "Action failed"));
    }
  };

  if (!adminEmail) {
    return (
      <div className="vben-page">
        <div className="vben-page__header">
          <h1 className="vben-page__title">{language === "zh-CN" ? "脚本分享" : "Script shares"}</h1>
        </div>
        <p>{messages.common.adminLoginRequired}</p>
        <Link href="/admin/login">{messages.common.goAdminLogin}</Link>
      </div>
    );
  }

  return (
    <div className="vben-page">
      <div className="vben-page__header">
        <div className="vben-row vben-row--between vben-row--center">
          <div>
            <h1 className="vben-page__title">{language === "zh-CN" ? "脚本分享" : "Script shares"}</h1>
            <p className="vben-page__subtitle">
              {language === "zh-CN"
                ? "管理员可上传并管理脚本（后台上传默认公开）。"
                : "Admins can upload and manage scripts (admin uploads are public by default)."}
            </p>
          </div>
          <Link href="/admin" className="btn btn-secondary btn-sm">
            {language === "zh-CN" ? "返回首页" : "Back"}
          </Link>
        </div>
      </div>

      {okMsg && <p style={{ marginTop: 10, color: "green" }}>{okMsg}</p>}
      {error && <p style={{ marginTop: 10, color: "red" }}>{error}</p>}

      <div className="user-page-card" style={{ marginTop: 14 }}>
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

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={uploadLang}
              onChange={(e) => setUploadLang(e.target.value as "zh-CN" | "en-US")}
              style={{ padding: "8px 10px", borderRadius: 6 }}
              aria-label="upload language"
              title={language === "zh-CN" ? "选择上传到哪个语言区" : "Choose target language"}
            >
              <option value="zh-CN">{language === "zh-CN" ? "上传到中文区" : "Upload to zh-CN"}</option>
              <option value="en-US">{language === "zh-CN" ? "上传到英文区" : "Upload to en-US"}</option>
            </select>
            <input
              id="admin-script-share-file-input"
              type="file"
              accept=".skmode"
              style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0 }}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.currentTarget.value = "";
                setUploadFile(f);
                if (f && isSkmodeFile(f) && !effectName.trim()) {
                  const base = basenameWithoutExt(f.name).trim();
                  if (base) setEffectName(base);
                }
              }}
            />

            <button
              type="button"
              className="script-share-upload-btn script-share-upload-btn--secondary"
              onClick={() => {
                const el = document.getElementById("admin-script-share-file-input") as HTMLInputElement | null;
                el?.click();
              }}
            >
              {language === "zh-CN" ? "选择脚本文件" : "Select file"}
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
              disabled={submitting || !canUpload}
              onClick={submitUpload}
            >
              {submitting
                ? language === "zh-CN"
                  ? "上传中..."
                  : "Uploading..."
                : language === "zh-CN"
                  ? "上传（公开）"
                  : "Upload (public)"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          placeholder={language === "zh-CN" ? "搜索：效果名/昵称/ID/归属邮箱" : "Search"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <select
          value={filterLang}
          onChange={(e) => setFilterLang(e.target.value as "all" | "zh-CN" | "en-US")}
          style={{ padding: "8px 10px", borderRadius: 6 }}
          aria-label="language filter"
        >
          <option value="all">{language === "zh-CN" ? "全部语言" : "All languages"}</option>
          <option value="zh-CN">{language === "zh-CN" ? "中文区" : "Chinese (zh-CN)"}</option>
          <option value="en-US">{language === "zh-CN" ? "英文区" : "English (en-US)"}</option>
        </select>
        <button type="button" disabled={loading} onClick={() => void fetchList(q)}>
          {language === "zh-CN" ? "搜索" : "Search"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setQ("");
            void fetchList("");
          }}
        >
          {language === "zh-CN" ? "重置" : "Reset"}
        </button>
        <button type="button" disabled={loading} onClick={() => void fetchList()}>
          {language === "zh-CN" ? "刷新" : "Refresh"}
        </button>
      </div>

      {loading ? (
        <p style={{ marginTop: 12 }}>{messages.common.loading}</p>
      ) : items.length === 0 ? (
        <p style={{ marginTop: 12, color: "#6b7280" }}>
          {language === "zh-CN" ? "暂无脚本分享记录。" : "No shares yet."}
        </p>
      ) : (
        <div className="script-share-grid" style={{ marginTop: 12 }}>
          {items.map((it) => (
            <ShareCard
              key={it.id}
              item={it}
              language={language}
              onDelete={handleDelete}
              onReupload={handleReupload}
              onTogglePublic={handleTogglePublic}
            />
          ))}
        </div>
      )}
    </div>
  );
}


