"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AppLanguage } from "../client-prefs";
import { getUserMessages } from "../user-i18n";
import type { OrderSnapshot } from "../hooks/useUserOrdersPreview";

export default function UserOrdersReadOnlyPanel({
  language,
  items,
  loading,
  error,
  limit = 5,
}: {
  language: AppLanguage;
  items: OrderSnapshot[];
  loading: boolean;
  error: string;
  limit?: number;
}) {
  const messages = useMemo(() => getUserMessages(language), [language]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const topItems = items.slice(0, Math.max(1, limit));

  return (
    <section className="user-page-section" style={{ marginTop: 14 }}>
      <div className="user-page-section__header">
        <h2 className="user-page-section__title" style={{ margin: 0 }}>
          {messages.home.orderPreviewTitle}
        </h2>
        <p className="user-page-section__subtext" style={{ margin: 0 }}>
          {messages.home.orderPreviewSubtitle(items.length)}
        </p>
      </div>

      <div className="user-page-card">
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <Link href="/devices#order-section" className="btn btn-secondary btn-sm">
            {messages.home.orderPreviewGoUpload}
          </Link>
          <Link href="/devices#order-section" className="btn btn-primary btn-sm">
            {messages.home.orderPreviewViewAll}
          </Link>
        </div>

        {loading && (
          <p style={{ marginTop: 12, fontSize: 13, color: "#9ca3af" }}>
            {messages.common.loading}
          </p>
        )}

        {!loading && error && (
          <p style={{ marginTop: 12, fontSize: 13, color: "#f87171" }}>
            {error}
          </p>
        )}

        {!loading && !error && topItems.length === 0 && (
          <p style={{ marginTop: 12, fontSize: 13, color: "#9ca3af" }}>
            {messages.home.orderPreviewEmpty}
          </p>
        )}

        {!loading && !error && topItems.length > 0 && (
          <div style={{ marginTop: 12, overflowX: "auto" }}>
            <div
              style={{
                minWidth: 860,
                border: "1px solid #d1d5db",
                borderRadius: 8,
                background: "#ffffff",
              }}
            >
              {/* 表头行 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "6px 8px",
                  borderBottom: "1px solid #d1d5db",
                  fontSize: 11,
                  background: "#f3f4f6",
                  color: "#374151",
                  fontWeight: 600,
                }}
              >
                <div
                  style={{
                    width: 80,
                    flexShrink: 0,
                    borderRight: "1px solid #d1d5db",
                    textAlign: "center",
                  }}
                >
                  {language === "zh-CN" ? "截图" : "Screenshot"}
                </div>
                <div
                  style={{
                    flex: 1,
                    minWidth: 120,
                    borderRight: "1px solid #d1d5db",
                    textAlign: "center",
                  }}
                >
                  {language === "zh-CN" ? "店铺" : "Shop"}
                </div>
                <div
                  style={{
                    flex: 1.2,
                    minWidth: 150,
                    borderRight: "1px solid #d1d5db",
                    textAlign: "center",
                  }}
                >
                  {language === "zh-CN" ? "订单号" : "Order No"}
                </div>
                <div
                  style={{
                    flex: 1.1,
                    minWidth: 160,
                    borderRight: "1px solid #d1d5db",
                    textAlign: "center",
                  }}
                >
                  {language === "zh-CN" ? "创建时间" : "Created At"}
                </div>
                <div
                  style={{
                    flex: 1.1,
                    minWidth: 160,
                    borderRight: "1px solid #d1d5db",
                    textAlign: "center",
                  }}
                >
                  {language === "zh-CN" ? "付款时间" : "Paid At"}
                </div>
                <div
                  style={{
                    width: 60,
                    flexShrink: 0,
                    borderRight: "1px solid #d1d5db",
                    textAlign: "center",
                  }}
                >
                  {language === "zh-CN" ? "数量" : "Qty"}
                </div>
                <div
                  style={{
                    flex: 1.2,
                    minWidth: 160,
                    textAlign: "center",
                  }}
                >
                  {language === "zh-CN" ? "备注" : "Note"}
                </div>
              </div>

              {/* 数据行 */}
              {topItems.map((o, idx) => (
                <div
                  key={o.id}
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    padding: "6px 8px",
                    borderTop: "1px solid #f3f4f6",
                    fontSize: 11,
                    color: "#4b5563",
                    backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f9fafb",
                  }}
                >
                  {/* 截图 */}
                  <div
                    style={{
                      width: 80,
                      height: 56,
                      overflow: "hidden",
                      borderRadius: 4,
                      flexShrink: 0,
                      borderRight: "1px solid #d1d5db",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewUrl(o.imageUrl)}
                      style={{
                        padding: 0,
                        border: "none",
                        background: "transparent",
                        cursor: "zoom-in",
                        display: "block",
                        width: "100%",
                        height: "100%",
                      }}
                      aria-label={messages.home.orderPreviewOpen}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={o.imageUrl}
                        alt="order"
                        width={80}
                        height={56}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    </button>
                  </div>

                  {/* 店铺 */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 120,
                      display: "flex",
                      alignItems: "center",
                      borderRight: "1px solid #d1d5db",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: "0 6px",
                    }}
                  >
                    {o.shopName ?? o.platform ?? "-"}
                  </div>

                  {/* 订单号 */}
                  <div
                    style={{
                      flex: 1.2,
                      minWidth: 150,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "flex",
                      alignItems: "center",
                      borderRight: "1px solid #d1d5db",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: "0 6px",
                    }}
                    title={o.orderNo ?? undefined}
                  >
                    {o.orderNo ?? `${messages.home.orderPreviewOrderNoFallback}${o.id}`}
                  </div>

                  {/* 创建时间 */}
                  <div
                    style={{
                      flex: 1.1,
                      minWidth: 160,
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      borderRight: "1px solid #d1d5db",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: "0 6px",
                    }}
                  >
                    {o.orderCreatedTime ?? new Date(o.createdAt).toLocaleString()}
                  </div>

                  {/* 付款时间 */}
                  <div
                    style={{
                      flex: 1.1,
                      minWidth: 160,
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      borderRight: "1px solid #d1d5db",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: "0 6px",
                    }}
                  >
                    {o.orderPaidTime ?? "-"}
                  </div>

                  {/* 数量 */}
                  <div
                    style={{
                      width: 60,
                      flexShrink: 0,
                      textAlign: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRight: "1px solid #d1d5db",
                      padding: "0 6px",
                    }}
                  >
                    {o.deviceCount != null ? String(o.deviceCount) : "-"}
                  </div>

                  {/* 备注 */}
                  <div
                    style={{
                      flex: 1.2,
                      minWidth: 160,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: "#6b7280",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: "0 6px",
                    }}
                    title={o.note ?? undefined}
                  >
                    {o.note ?? "-"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 图片预览弹窗（只读） */}
      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setPreviewUrl(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "rgba(0, 0, 0, 0.8)",
            cursor: "zoom-out",
          }}
        >
          <button
            type="button"
            onClick={() => setPreviewUrl(null)}
            style={{ position: "absolute", top: 16, right: 16 }}
            className="btn btn-secondary btn-icon btn-lg"
            aria-label={language === "zh-CN" ? "关闭预览" : "Close preview"}
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="preview"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              objectFit: "contain",
              borderRadius: 8,
              boxShadow: "0 4px 32px rgba(0, 0, 0, 0.5)",
              cursor: "default",
            }}
          />
        </div>
      )}
    </section>
  );
}


