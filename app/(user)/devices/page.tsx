"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Device = {
  id: number;
  deviceId: string;
  warrantyExpiresAt: string;
};

export default function UserDevicesPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [newDeviceId, setNewDeviceId] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const email = window.localStorage.getItem("loggedInUserEmail");
      if (email) {
        setUserEmail(email);
      }
    }
  }, []);

  useEffect(() => {
    const loadDevices = async (email: string) => {
      setLoading(true);
      setError("");
      setOkMsg("");
      try {
        const res = await fetch(
          `/api/user/devices?email=${encodeURIComponent(email)}`
        );
        if (!res.ok) {
          if (res.status === 404) {
            setDevices([]);
            return;
          }
          const text = await res.text();
          throw new Error(text || "获取设备信息失败");
        }
        const data = (await res.json()) as Device[];
        setDevices(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "获取设备信息失败");
      } finally {
        setLoading(false);
      }
    };

    if (userEmail) {
      loadDevices(userEmail);
    }
  }, [userEmail]);

  if (!userEmail) {
    return (
      <div style={{ maxWidth: 640, margin: "80px auto" }}>
        <h1>设备信息管理</h1>
        <p>未检测到用户登录，请先登录。</p>
        <Link href="/login">去登录</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "80px auto" }}>
      <h1>设备信息管理</h1>
      <p style={{ marginTop: 8, fontSize: 14, color: "#9ca3af" }}>
        管理并查看与你账号绑定的设备信息。
      </p>

      {loading && <p style={{ marginTop: 16 }}>加载中...</p>}
      {error && (
        <p style={{ marginTop: 16, color: "red" }}>
          {error || "获取设备信息失败"}
        </p>
      )}
      {okMsg && (
        <p style={{ marginTop: 16, color: "green" }}>
          {okMsg}
        </p>
      )}

      <section className="user-page-section">
        <div className="user-page-section__header">
          <h2 className="user-page-section__title">添加设备</h2>
          <p className="user-page-section__subtext">
            输入设备 ID 并点击“添加设备”，系统会自动为你记录并计算质保到期时间。
          </p>
        </div>
        <div className="user-page-card">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              placeholder="请输入设备 ID"
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
                  setError("请输入设备 ID");
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
                    throw new Error(text || "添加设备失败");
                  }
                  const data = (await res.json()) as Device;
                  setDevices((prev) => [...prev, data]);
                  setOkMsg("设备已添加");
                  setNewDeviceId("");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "添加设备失败");
                }
              }}
            >
              添加设备
            </button>
          </div>
        </div>
      </section>

      <section className="user-page-section" style={{ marginTop: 28 }}>
        <div className="user-page-section__header">
          <h2 className="user-page-section__title">我的设备列表</h2>
          <p className="user-page-section__subtext">
            查看当前账号下已登记的全部设备及对应的质保到期时间。
          </p>
        </div>
        <div className="user-page-card">
          {devices.length === 0 ? (
            <p className="user-page-card__item-meta">
              当前没有已登记的设备。
            </p>
          ) : (
            devices.map((d) => (
              <div
                key={d.id}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(148,163,184,0.6)",
                  backgroundColor: "rgba(15,23,42,0.85)",
                  boxShadow:
                    "0 10px 22px rgba(15,23,42,0.85), inset 0 0 0 1px rgba(15,23,42,0.9)",
                  fontSize: 14,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div className="user-page-card__item-title">
                      设备 ID：<strong>{d.deviceId}</strong>
                    </div>
                    <div className="user-page-card__item-meta">
                      质保到期时间：
                      <strong>
                        {new Date(d.warrantyExpiresAt).toLocaleString()}
                      </strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    style={{
                      padding: "6px 10px",
                      borderRadius: 9999,
                      border: "1px solid rgba(248,113,113,0.8)",
                      background:
                        "radial-gradient(circle at 0 0, rgba(248,113,113,0.18), rgba(30,64,175,0.96))",
                      color: "#fecaca",
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    }}
                    onClick={async () => {
                      if (!userEmail) return;
                      const ok = window.confirm(
                        `确定要删除设备 ${d.deviceId} 吗？删除后将无法恢复。`
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
                          throw new Error(text || "删除设备失败");
                        }
                        setDevices((prev) =>
                          prev.filter((item) => item.id !== d.id)
                        );
                        setOkMsg("设备已删除");
                      } catch (e) {
                        setError(
                          e instanceof Error ? e.message : "删除设备失败"
                        );
                      }
                    }}
                  >
                    删除设备
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}


