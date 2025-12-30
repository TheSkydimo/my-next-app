"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getUserMessages } from "../../user-i18n";
import { useUser } from "../../contexts/UserContext";
import { useAutoDismissMessage } from "../../hooks/useAutoDismissMessage";
import { AuthEmailCodePage } from "../../components/AuthEmailCodePage";

type FavoriteItem = {
  id: string;
  effectName: string;
  publicUsername: string;
  lang: AppLanguage;
  isPublic: boolean;
  isPinned: boolean;
  pinnedAt: string | null;
  coverUrl: string;
  originalFilename: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  favoritedAt: string;
  likeCount: number;
  favoriteCount: number;
  likedByMe: boolean;
  favoritedByMe: boolean;
  likeCanUndo: boolean;
  likeLocked: boolean;
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

function FavoriteCard({
  item,
  language,
  likeBusy,
  favoriteBusy,
  onToggleLike,
  onToggleFavorite,
}: {
  item: FavoriteItem;
  language: AppLanguage;
  likeBusy?: boolean;
  favoriteBusy?: boolean;
  onToggleLike?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
}) {
  const downloadUrl = `/api/script-shares/${encodeURIComponent(item.id)}/download`;
  const likeCount = Number.isFinite(item.likeCount) ? item.likeCount : 0;
  const favoriteCount = Number.isFinite(item.favoriteCount) ? item.favoriteCount : 0;

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
          {item.isPinned && (
            <span className="script-share-card__pill">
              {language === "zh-CN" ? "置顶" : "Pinned"}
            </span>
          )}
          {!item.isPublic && (
            <span className="script-share-card__pill script-share-card__pill--private">
              {language === "zh-CN" ? "私密" : "Private"}
            </span>
          )}
          <span className="script-share-card__pill" title={item.originalFilename}>
            {item.originalFilename}
          </span>
          <span className="script-share-card__pill">{formatBytes(item.sizeBytes)}</span>
          <span className="script-share-card__time">
            {language === "zh-CN" ? "收藏：" : "Favorited: "}
            {new Date(item.favoritedAt).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="script-share-card__actions">
        <a className="script-share-card__btn script-share-card__btn--primary" href={downloadUrl}>
          {language === "zh-CN" ? "下载" : "Download"}
        </a>

        <button
          type="button"
          className="script-share-card__btn script-share-card__btn--secondary"
          disabled={!!likeBusy || !!item.likeLocked}
          aria-label={
            item.likedByMe
              ? language === "zh-CN"
                ? "取消点赞"
                : "Unlike"
              : language === "zh-CN"
                ? "点赞"
                : "Like"
          }
          title={
            item.likeLocked
              ? language === "zh-CN"
                ? "点赞已超过 24 小时，无法取消"
                : "Like is older than 24h and cannot be undone"
              : item.likedByMe
                ? language === "zh-CN"
                  ? "点击取消点赞（24h内可撤销）"
                  : "Click to unlike (undo within 24h)"
                : language === "zh-CN"
                  ? "点赞"
                  : "Like"
          }
          onClick={() => onToggleLike?.(item.id)}
        >
          <span className="script-share-card__btn-icon" aria-hidden="true">
            {item.likedByMe ? "♥️" : "👍"}
          </span>
          <span className="script-share-card__btn-count">{likeCount}</span>
        </button>

        <button
          type="button"
          className="script-share-card__btn script-share-card__btn--secondary"
          disabled={!!favoriteBusy}
          aria-label={language === "zh-CN" ? "取消收藏" : "Unfavorite"}
          title={language === "zh-CN" ? "点击取消收藏" : "Click to unfavorite"}
          onClick={() => onToggleFavorite?.(item.id)}
        >
          <span className="script-share-card__btn-icon" aria-hidden="true">
            {"⭐"}
          </span>
          <span className="script-share-card__btn-count">{favoriteCount}</span>
        </button>
      </div>
    </div>
  );
}

export default function FavoritesPage() {
  const userContext = useUser();
  const isUserInitialized = userContext.initialized;
  const hasUser = !!userContext.profile?.email;

  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const messages = getUserMessages(language);

  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useAutoDismissMessage(2000);
  const [okMsg, setOkMsg] = useAutoDismissMessage(2000);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setLanguage(getInitialLanguage());
  }, []);

  const totalPages = useMemo(() => {
    const t = Number.isFinite(total) ? total : 0;
    return Math.max(1, Math.ceil(t / pageSize));
  }, [total]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      const res = await fetch(`/api/user/script-share-favorites?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { items?: FavoriteItem[]; total?: number };
      setItems(data.items ?? []);
      setTotal(Number.isFinite(data.total) ? (data.total as number) : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : (language === "zh-CN" ? "加载失败" : "Failed to load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasUser) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUser, page]);

  const applyInteractionUpdate = (
    id: string,
    patch: Partial<
      Pick<
        FavoriteItem,
        | "likeCount"
        | "favoriteCount"
        | "likedByMe"
        | "favoritedByMe"
        | "likeCanUndo"
        | "likeLocked"
      >
    >
  ) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const toggleLike = async (id: string) => {
    setError("");
    setOkMsg("");
    setBusyKey(`like:${id}`);
    try {
      const res = await fetch(`/api/user/script-shares/${encodeURIComponent(id)}/like`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        ok: true;
        id: string;
        likeCount: number;
        favoriteCount: number;
        likedByMe: boolean;
        favoritedByMe: boolean;
        likeCanUndo: boolean;
        likeLocked: boolean;
      };
      applyInteractionUpdate(id, {
        likeCount: data.likeCount,
        favoriteCount: data.favoriteCount,
        likedByMe: data.likedByMe,
        favoritedByMe: data.favoritedByMe,
        likeCanUndo: data.likeCanUndo,
        likeLocked: data.likeLocked,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : (language === "zh-CN" ? "操作失败" : "Action failed"));
    } finally {
      setBusyKey(null);
    }
  };

  const toggleFavorite = async (id: string) => {
    setError("");
    setOkMsg("");
    setBusyKey(`fav:${id}`);
    try {
      const res = await fetch(`/api/user/script-shares/${encodeURIComponent(id)}/favorite`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        ok: true;
        id: string;
        likeCount: number;
        favoriteCount: number;
        likedByMe: boolean;
        favoritedByMe: boolean;
        likeCanUndo: boolean;
        likeLocked: boolean;
      };
      if (!data.favoritedByMe) {
        // unfavorited: remove from this list
        setItems((prev) => prev.filter((x) => x.id !== id));
        setOkMsg(language === "zh-CN" ? "已取消收藏" : "Unfavorited");
      } else {
        applyInteractionUpdate(id, {
          likeCount: data.likeCount,
          favoriteCount: data.favoriteCount,
          likedByMe: data.likedByMe,
          favoritedByMe: data.favoritedByMe,
          likeCanUndo: data.likeCanUndo,
          likeLocked: data.likeLocked,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : (language === "zh-CN" ? "操作失败" : "Action failed"));
    } finally {
      setBusyKey(null);
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
    return <AuthEmailCodePage variant="user" />;
  }

  return (
    <div className="vben-page">
      <div className="vben-page__header">
        <h1 className="vben-page__title">{language === "zh-CN" ? "我的收藏" : "My favorites"}</h1>
        <p className="vben-page__subtitle">
          {language === "zh-CN"
            ? "这里展示你收藏过的脚本分享。"
            : "All script shares you have favorited."}
        </p>
      </div>

      {okMsg && <p style={{ marginTop: 12, color: "green" }}>{okMsg}</p>}
      {error && <p style={{ marginTop: 12, color: "red" }}>{error}</p>}

      {loading ? (
        <p style={{ marginTop: 12 }}>{messages.common.loading}</p>
      ) : items.length === 0 ? (
        <p style={{ marginTop: 12, color: "#6b7280" }}>
          {language === "zh-CN" ? "你还没有收藏任何脚本。" : "No favorites yet."}
        </p>
      ) : (
        <>
          <div className="script-share-grid" style={{ marginTop: 12 }}>
            {items.map((it) => (
              <FavoriteCard
                key={it.id}
                item={it}
                language={language}
                likeBusy={busyKey === `like:${it.id}`}
                favoriteBusy={busyKey === `fav:${it.id}`}
                onToggleLike={toggleLike}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div
              style={{
                marginTop: 14,
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                {language === "zh-CN" ? `共 ${totalPages} 页` : `Total ${totalPages} pages`}
              </span>
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {language === "zh-CN" ? "上一页" : "Prev"}
              </button>
              <button
                type="button"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {language === "zh-CN" ? "下一页" : "Next"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}


