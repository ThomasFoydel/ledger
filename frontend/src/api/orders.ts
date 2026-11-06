import { API_PREFIX, getCsrfToken } from "./client";
import type { PageResult } from "./products";

export type AdminOrderFilters = {
  search?: string;
  archive?: "active" | "archived" | "all";
  page?: number;
  pageSize?: number;
};

export type CustomerOrderItem = {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
};

export type OrderShipment = {
  id: string;
  parcelNumber: number;
  carrier: string | null;
  serviceName: string | null;
  status: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAtUtc: string | null;
};

export type CustomerOrder = {
  id: string;
  status: string;
  fulfillmentStatus: string;
  shipments: OrderShipment[];
  currency: string;
  subtotalAmount: number;
  shippingAmount: number;
  totalAmount: number;
  shippingServiceToken: string | null;
  shippingServiceName: string | null;
  shippingProvider: string | null;
  shippingName: string | null;
  shippingStreet1: string | null;
  shippingStreet2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  createdAtUtc: string;
  paidAtUtc: string | null;
  items: CustomerOrderItem[];
};

export type AdminOrder = CustomerOrder & {
  customerEmail: string | null;
  userId: string | null;
  isArchived: boolean;
};

export async function getOrders(): Promise<CustomerOrder[]> {
  const response = await fetch(`${API_PREFIX}/orders`, {
    credentials: "include",
  });

  if (response.status === 401) {
    throw new Error("Please sign in to view your orders.");
  }
  if (!response.ok) {
    throw new Error("Could not load your orders.");
  }

  return response.json() as Promise<CustomerOrder[]>;
}

export async function getAdminOrders(
  filters: AdminOrderFilters = {},
): Promise<PageResult<AdminOrder>> {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.archive) params.set("archive", filters.archive);
  params.set("page", String(filters.page ?? 1));
  params.set("pageSize", String(filters.pageSize ?? 20));

  const response = await fetch(
    `${API_PREFIX}/admin/orders?${params.toString()}`,
    { credentials: "include" },
  );

  if (response.status === 401 || response.status === 403) {
    throw new Error("You are not authorized to view all orders.");
  }
  if (!response.ok) throw new Error("Could not load all orders.");

  return response.json() as Promise<PageResult<AdminOrder>>;
}

export async function setOrderArchived(
  orderId: string,
  isArchived: boolean,
): Promise<void> {
  const response = await fetch(
    `${API_PREFIX}/admin/orders/${encodeURIComponent(orderId)}/archive`,
    {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": await getCsrfToken(),
      },
      body: JSON.stringify({ isArchived }),
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new Error("You are not authorized to archive orders.");
  }
  if (response.status === 404) throw new Error("Order not found.");
  if (!response.ok) throw new Error("Could not update order archive status.");
}

export async function updateOrderShipmentTracking(
  orderId: string,
  parcelNumber: number,
  trackingNumber: string | null,
  trackingUrl: string | null,
): Promise<void> {
  const requestToken = await getCsrfToken();

  const response = await fetch(
    `${API_PREFIX}/admin/orders/${encodeURIComponent(orderId)}/shipments/${parcelNumber}/tracking`,
    {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": requestToken,
      },
      body: JSON.stringify({ trackingNumber, trackingUrl }),
    },
  );

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      message?: string;
      title?: string;
      errors?: Record<string, string[]>;
    } | null;

    const validationMessage = data?.errors
      ? Object.values(data.errors).flat().join(" ")
      : "";

    throw new Error(
      data?.message ||
        validationMessage ||
        data?.title ||
        "Could not update shipment tracking.",
    );
  }
}
