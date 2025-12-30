export const USER_ORDERS_INVALIDATED_EVENT = "user-orders-invalidated";

export type UserOrdersInvalidatedDetail = {
  source: "notification" | "unknown";
  notificationIds?: number[];
  notificationTypes?: string[];
};

export function dispatchUserOrdersInvalidated(detail: UserOrdersInvalidatedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<UserOrdersInvalidatedDetail>(USER_ORDERS_INVALIDATED_EVENT, {
      detail,
    })
  );
}


