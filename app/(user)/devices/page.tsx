"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getUserMessages } from "../../user-i18n";

type Device = {
  id: number;
  deviceId: string;
  warrantyExpiresAt: string;
};

export default function UserDevicesPage() {
  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [newDeviceId, setNewDeviceId] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 5;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initialLang = getInitialLanguage();
    setLanguage(initialLang);

    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ language: AppLanguage }>;
      if (custom.detail?.language) {
        setLanguage(custom.detail.language);
      }
    };

    window.addEventListener("app-language-changed", handler as EventListener);
    return () => {
      window.removeEventListener(
        "app-language-changed",
        handler as EventListener
      );
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const email = window.localStorage.getItem("loggedInUserEmail");
      if (email) {
        setUserEmail(email);
      }
    }
  }, []);


  useEffect(() => {
    const loadDevices = async (email: string, pageNumber: number) => {
      setLoading(true);
      setError("");
      setOkMsg("");
      try {
        const res = await fetch(
          `/api/user/devices?email=${encodeURIComponent(
            email
          )}&page=${pageNumber}`
        );
        if (!res.ok) {
          if (res.status === 404) {
            setDevices([]);
            setTotal(0);
            return;
          }
          const text = await res.text();
          throw new Error(text || messages.devices.fetchFailed);
        }
        const data: unknown = await res.json();
        if (Array.isArray(data)) {
          // 兼容旧结构
          const list = data as Device[];
          setDevices(list);
          setTotal(list.length);
          setPage(1);
        } else {
          const obj = data as {
            items?: Device[];
            total?: number;
          };
          const items = obj.items ?? [];
          setDevices(items);
          setTotal(typeof obj.total === "number" ? obj.total : items.length);
        }
      } catch (e) {
        setError(
          e instanceof Error ? e.message : messages.devices.fetchFailed
        );
      } finally {
        setLoading(false);
      }
    };

    if (userEmail) {
      loadDevices(userEmail, page);
    }
  }, [userEmail, page]);

  const messages = getUserMessages(language);

  const maxPage = Math.max(1, Math.ceil(total / pageSize) || 1);
  const hasPrev = page > 1;
  const hasNext = page < maxPage;

  if (!userEmail) {
    return (
      <div style={{ maxWidth: 640, margin: "10px auto" }}>
        <h1>{messages.devices.title}</h1>
        <p>{messages.common.loginRequired}</p>
        <Link href="/login">{messages.common.goLogin}</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "10px auto" }}>
      <h1>{messages.devices.title}</h1>
      <p style={{ marginTop: 8, fontSize: 14, color: "#9ca3af" }}>
        {messages.devices.subtitle}
      </p>

      {loading && (
        <p style={{ marginTop: 16 }}>{messages.common.loading}</p>
      )}
      {error && (
        <p style={{ marginTop: 16, color: "red" }}>
          {error || messages.devices.fetchFailed}
        </p>
      )}
      {okMsg && (
        <p style={{ marginTop: 16, color: "green" }}>
          {okMsg}
        </p>
      )}

      <section className="user-page-section">
        <div className="user-page-section__header">
          <h2 className="user-page-section__title">
            {messages.devices.addSectionTitle}
          </h2>
          <p className="user-page-section__subtext">
            {messages.devices.addSectionDesc}
          </p>
        </div>
        <div className="user-page-card">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              placeholder={messages.devices.inputPlaceholder}
              value={newDeviceId}
              onChange={(e) => setNewDeviceId(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={async () => {
                if (!userEmail) return;
                const trimmed = newDeviceId.trim();
                if (!trimmed) {
                  setError(messages.devices.addEmptyError);
                  setOkMsg("");
                  return;
                }

                setError("");
                setOkMsg("");

                try {
                  const res = await fetch("/api/user/devices", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      email: userEmail,
                      deviceId: trimmed,
                    }),
                  });
                  if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || messages.devices.addFailed);
                  }
                  await res.json();
                  setOkMsg(messages.devices.addSuccess);
                  setNewDeviceId("");
                  setTotal((prev) => prev + 1);
                  setPage(1);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : messages.devices.addFailed
                  );
                }
              }}
            >
              {messages.devices.addButton}
            </button>
          </div>
        </div>
      </section>

      <section className="user-page-section" style={{ marginTop: 28 }}>
        <div className="user-page-section__header">
          <h2 className="user-page-section__title">
            {messages.devices.listTitle}
          </h2>
          <p className="user-page-section__subtext">
            {messages.devices.listSubtitle}
          </p>
        </div>
        <div className="user-page-card">
          {devices.length === 0 ? (
            <p className="user-page-card__item-meta">
              {messages.devices.emptyText}
            </p>
          ) : (
            devices.map((d) => (
              <div key={d.id} className="user-device-card">
                <div className="user-device-card__row">
                  <div>
                    <div className="user-page-card__item-title">
                      {messages.devices.inputPlaceholder}：
                      <strong>{d.deviceId}</strong>
                    </div>
                    <div className="user-page-card__item-meta">
                      {messages.devices.warrantyLabel}
                      <strong>
                        {new Date(d.warrantyExpiresAt).toLocaleString()}
                      </strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="user-device-card__remove"
                    onClick={async () => {
                      if (!userEmail) return;
                      const ok = window.confirm(
                        messages.devices.deleteConfirm(d.deviceId)
                      );
                      if (!ok) return;

                      setError("");
                      setOkMsg("");

                      try {
                        const res = await fetch("/api/user/devices", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            email: userEmail,
                            id: d.id,
                          }),
                        });
                        if (!res.ok) {
                          const text = await res.text();
                          throw new Error(text || messages.devices.deleteFailed);
                        }
                        setDevices((prev) => {
                          const next = prev.filter((item) => item.id !== d.id);
                          if (next.length === 0 && page > 1) {
                            setPage((p) => Math.max(1, p - 1));
                          }
                          return next;
                        });
                        setTotal((prev) => Math.max(0, prev - 1));
                        setOkMsg(messages.devices.deleteSuccess);
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : messages.devices.deleteFailed
                        );
                      }
                    }}
                  >
                    {messages.devices.deleteButton}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12,
            color: "#9ca3af",
          }}
        >
          <span>
            {messages.devices.pagerText(
              total,
              Math.min(page, maxPage),
              maxPage
            )}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={!hasPrev}
              onClick={() => hasPrev && setPage((p) => Math.max(1, p - 1))}
              style={{
                padding: "4px 10px",
                borderRadius: 9999,
                fontSize: 12,
                opacity: hasPrev ? 1 : 0.5,
              }}
            >
              {language === "zh-CN" ? "上一页" : "Prev"}
            </button>
            <button
              type="button"
              disabled={!hasNext}
              onClick={() =>
                hasNext && setPage((p) => Math.min(maxPage, p + 1))
              }
              style={{
                padding: "4px 10px",
                borderRadius: 9999,
                fontSize: 12,
                opacity: hasNext ? 1 : 0.5,
              }}
            >
              {language === "zh-CN" ? "下一页" : "Next"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}


