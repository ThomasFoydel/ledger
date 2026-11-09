import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { AdminOrder, Product, User } from "./api";
import * as api from "./api";

vi.mock("./api", () => ({
  getCurrentUser: vi.fn(),
  getProducts: vi.fn(),
  getProductTags: vi.fn(),
  getAdminProducts: vi.fn(),
  setProductVisibility: vi.fn(),
  getAdminOrders: vi.fn(),
  setOrderArchived: vi.fn(),
  getSiteSettings: vi.fn(),
  updateSiteSettings: vi.fn(),
  uploadSiteLogo: vi.fn(),
  deleteSiteLogo: vi.fn(),
  uploadSiteFavicon: vi.fn(),
  deleteSiteFavicon: vi.fn(),
  createCheckoutSession: vi.fn(),
  getCheckoutSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));

function renderApp(initialEntry = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
    </MemoryRouter>,
  );
}

const adminUser: User = {
  email: "owner@example.com",
  isAdmin: true,
};

const regularUser: User = {
  email: "customer@example.com",
  isAdmin: false,
};

const testSiteSettings = {
  pageTitle: "Test Store",
  headerText: "Test Store",
  heroTitle: "Find something\\nworth keeping.",
  heroDescription:
    "Browse our collection and find just what you’re looking for.",
  footerText: "Thoughtfully managed. Simply shopped.",
  logoUrl: null,
  faviconUrl: null,
};

const sampleProduct: Product = {
  id: "product-1",
  name: "Lavender Soap",
  description: "Handmade lavender bar",
  price: 8.5,
  isActive: true,
  createdAtUtcs: "2026-01-01T00:00:00Z",
  quantityOnHand: 12,
  hasImage: false,
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.resetAllMocks();
  vi.mocked(api.getCurrentUser).mockResolvedValue(null);
  vi.mocked(api.getProducts).mockImplementation(async (query) => {
    if (!query?.trim()) return [sampleProduct];

    const normalizedQuery = query.trim().toLowerCase();
    return [sampleProduct].filter(
      (product) =>
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.description?.toLowerCase().includes(normalizedQuery),
    );
  });
  vi.mocked(api.getProductTags).mockResolvedValue([]);
  vi.mocked(api.getAdminProducts).mockResolvedValue({
    items: [sampleProduct],
    totalCount: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  });
  vi.mocked(api.setProductVisibility).mockResolvedValue(undefined);
  vi.mocked(api.getAdminOrders).mockResolvedValue({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  });
  vi.mocked(api.setOrderArchived).mockResolvedValue(undefined);
  vi.mocked(api.getSiteSettings).mockResolvedValue(testSiteSettings);
  vi.mocked(api.updateSiteSettings).mockResolvedValue(testSiteSettings);
  vi.mocked(api.uploadSiteLogo).mockResolvedValue(testSiteSettings);
  vi.mocked(api.deleteSiteLogo).mockResolvedValue(testSiteSettings);
  vi.mocked(api.uploadSiteFavicon).mockResolvedValue(testSiteSettings);
  vi.mocked(api.deleteSiteFavicon).mockResolvedValue(testSiteSettings);
  vi.mocked(api.createCheckoutSession).mockResolvedValue({
    sessionId: "cs_test_123",
    url: "https://checkout.stripe.com/c/pay/cs_test_123",
  });
  vi.mocked(api.getCheckoutSession).mockResolvedValue({
    orderId: "order-1",
    status: "Pending",
  });
  vi.mocked(api.login).mockResolvedValue(undefined);
  vi.mocked(api.logout).mockResolvedValue(undefined);
  vi.mocked(api.createProduct).mockResolvedValue(sampleProduct);
  vi.mocked(api.updateProduct).mockResolvedValue(sampleProduct);
  vi.mocked(api.deleteProduct).mockResolvedValue(undefined);
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function renderSignedIn(user: User = adminUser) {
  vi.mocked(api.getCurrentUser).mockResolvedValue(user);

  renderApp();

  expect(await screen.findByText(user.email)).toBeInTheDocument();
}

async function signInAsAdmin() {
  renderApp();

  fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));

  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "owner@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "correct-password" },
  });

  vi.mocked(api.getCurrentUser).mockResolvedValue(adminUser);

  fireEvent.click(
    screen
      .getByRole("dialog")
      .querySelector<HTMLButtonElement>('button[type="submit"]')!,
  );

  fireEvent.click(await screen.findByRole("link", { name: "Admin" }));

  expect(
    await screen.findByRole("heading", { name: "Product management" }),
  ).toBeInTheDocument();
}

describe("Storefront", () => {
  it("shows the public storefront and products when signed out", async () => {
    renderApp();

    expect(
      await screen.findByRole("heading", { name: "Shop all products" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Lavender Soap" }),
    ).toBeInTheDocument();
    expect(screen.getByText("$8.50")).toBeInTheDocument();
    expect(screen.getByText("In stock")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Admin panel" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Product name")).not.toBeInTheDocument();
  });

  it("opens the sign-in dialog only after clicking Sign in", async () => {
    renderApp();

    await screen.findByRole("heading", { name: "Shop all products" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      screen.getByRole("dialog", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("closes the sign-in dialog with the close button", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Close sign-in dialog" }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("filters products by name and description", async () => {
    renderApp();

    await screen.findByRole("heading", { name: "Lavender Soap" });

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search products" }),
      {
        target: { value: "lavender" },
      },
    );

    expect(
      screen.getByRole("heading", { name: "Lavender Soap" }),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search products" }),
      {
        target: { value: "mint" },
      },
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Lavender Soap" }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("No matching products")).toBeInTheDocument();
    });
  });

  it("shows an out-of-stock status when quantity is zero", async () => {
    vi.mocked(api.getProducts).mockResolvedValue([
      { ...sampleProduct, quantityOnHand: 0 },
    ]);

    renderApp();

    expect(await screen.findByText("Out of stock")).toBeInTheDocument();
  });
});

describe("Authentication and role-based access", () => {
  it("signs in and shows the admin panel for an Owner", async () => {
    await signInAsAdmin();

    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Add a product" }),
    ).toBeInTheDocument();
    expect(api.login).toHaveBeenCalledWith(
      "owner@example.com",
      "correct-password",
    );
  });

  it("keeps a regular signed-in user on the storefront without admin controls", async () => {
    await renderSignedIn(regularUser);

    expect(
      screen.getByRole("heading", { name: "Shop all products" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Admin panel" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Admin" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });

  it("shows an error when sign-in fails", async () => {
    vi.mocked(api.login).mockRejectedValue(
      new Error("Invalid email or password."),
    );

    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" },
    });

    fireEvent.click(
      screen
        .getByRole("dialog")
        .querySelector<HTMLButtonElement>('button[type="submit"]')!,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password.",
    );
    expect(
      screen.queryByRole("heading", { name: "Admin panel" }),
    ).not.toBeInTheDocument();
  });

  it("signs out and keeps the storefront visible", async () => {
    await renderSignedIn(adminUser);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Sign in" }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("heading", { name: "Shop all products" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Admin panel" }),
    ).not.toBeInTheDocument();
  });
});

describe("Admin product management", () => {
  it("creates a product", async () => {
    await signInAsAdmin();

    fireEvent.change(screen.getByLabelText("Product name"), {
      target: { value: "Mint Soap" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Fresh mint soap" },
    });
    fireEvent.change(screen.getByLabelText("Price (USD)"), {
      target: { value: "9" },
    });
    fireEvent.change(screen.getByLabelText("Quantity on hand"), {
      target: { value: "20" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add product" }));

    await waitFor(() => {
      expect(api.createProduct).toHaveBeenCalledWith({
        name: "Mint Soap",
        description: "Fresh mint soap",
        price: 9,
        quantityOnHand: 20,
        tags: [],
      });
    });
  });

  it("edits a product", async () => {
    await signInAsAdmin();

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    await waitFor(() => {
      expect(screen.getByLabelText("Product name")).toHaveValue(
        "Lavender Soap",
      );
    });

    fireEvent.change(screen.getByLabelText("Product name"), {
      target: { value: "Lavender and Mint Soap" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(api.updateProduct).toHaveBeenCalledWith("product-1", {
        name: "Lavender and Mint Soap",
        description: "Handmade lavender bar",
        price: 8.5,
        quantityOnHand: 12,
        tags: [],
      });
    });
  });

  it("deletes a product after confirmation", async () => {
    await signInAsAdmin();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    await waitFor(() => {
      expect(api.deleteProduct).toHaveBeenCalledWith("product-1");
    });
  });

  it("does not delete a product when confirmation is declined", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false),
    );

    await signInAsAdmin();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    expect(api.deleteProduct).not.toHaveBeenCalled();
  });

  it("shows an error when product creation fails", async () => {
    vi.mocked(api.createProduct).mockRejectedValue(
      new Error("Could not create product."),
    );

    await signInAsAdmin();

    fireEvent.change(screen.getByLabelText("Product name"), {
      target: { value: "Mint Soap" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add product" }));

    expect(
      await screen.findByText("Could not create product.", {
        selector: '[role="alert"]',
      }),
    ).toBeInTheDocument();
  });
});

describe("admin management actions", () => {
  const sampleOrder: AdminOrder = {
    id: "order-1",
    status: "Paid",
    fulfillmentStatus: "Unfulfilled",
    shipments: [],
    currency: "usd",
    subtotalAmount: 16,
    shippingAmount: 5,
    totalAmount: 21,
    shippingServiceToken: null,
    shippingServiceName: null,
    shippingProvider: null,
    shippingName: "Test Customer",
    shippingStreet1: "123 Main St",
    shippingStreet2: null,
    shippingCity: "Rockford",
    shippingState: "IL",
    shippingPostalCode: "61101",
    shippingCountry: "US",
    createdAtUtc: "2026-01-01T00:00:00Z",
    paidAtUtc: "2026-01-01T00:05:00Z",
    items: [
      {
        productId: "product-1",
        productName: "Lavender Soap",
        unitPrice: 8,
        quantity: 2,
      },
    ],
    customerEmail: "customer@example.com",
    userId: "user-1",
    isArchived: false,
  };

  async function renderAdminRoute(path: string) {
    vi.mocked(api.getCurrentUser).mockResolvedValue(adminUser);
    renderApp(path);
    expect(await screen.findByText(adminUser.email)).toBeInTheDocument();
  }

  it("hides an active product through the visibility API", async () => {
    await renderAdminRoute("/admin/products");

    const hideButton = await screen.findByRole("button", { name: "Hide" });
    fireEvent.click(hideButton);

    await waitFor(() => {
      expect(api.setProductVisibility).toHaveBeenCalledWith("product-1", false);
    });
  });

  it("unhides a hidden product through the visibility API", async () => {
    vi.mocked(api.getAdminProducts).mockResolvedValue({
      items: [{ ...sampleProduct, isActive: false }],
      totalCount: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });

    await renderAdminRoute("/admin/products");

    fireEvent.click(await screen.findByRole("button", { name: "Unhide" }));

    await waitFor(() => {
      expect(api.setProductVisibility).toHaveBeenCalledWith("product-1", true);
    });
  });

  it("archives an active order through the archive API", async () => {
    vi.mocked(api.getAdminOrders).mockResolvedValue({
      items: [sampleOrder],
      totalCount: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });

    await renderAdminRoute("/admin/orders");

    fireEvent.click(await screen.findByText("customer@example.com"));

    fireEvent.click(
      await screen.findByRole("button", { name: "Archive order" }),
    );

    await waitFor(() => {
      expect(api.setOrderArchived).toHaveBeenCalledWith("order-1", true);
    });
  });

  it("restores an archived order through the archive API", async () => {
    vi.mocked(api.getAdminOrders).mockResolvedValue({
      items: [{ ...sampleOrder, isArchived: true }],
      totalCount: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });

    await renderAdminRoute("/admin/orders");

    fireEvent.click(await screen.findByText("customer@example.com"));

    fireEvent.click(
      await screen.findByRole("button", { name: "Unarchive order" }),
    );

    await waitFor(() => {
      expect(api.setOrderArchived).toHaveBeenCalledWith("order-1", false);
    });
  });

  it("requests archived orders when the order view filter changes", async () => {
    await renderAdminRoute("/admin/orders");

    fireEvent.change(await screen.findByLabelText("Order view"), {
      target: { value: "archived" },
    });

    await waitFor(() => {
      expect(api.getAdminOrders).toHaveBeenLastCalledWith(
        expect.objectContaining({ archive: "archived", page: 1 }),
      );
    });
  });

  it("shows an error when changing product visibility fails", async () => {
    vi.mocked(api.setProductVisibility).mockRejectedValueOnce(
      new Error("Visibility update failed"),
    );

    await renderAdminRoute("/admin/products");

    fireEvent.click(await screen.findByRole("button", { name: "Hide" }));

    expect(
      await screen.findByText("Visibility update failed"),
    ).toBeInTheDocument();
  });

  it("shows an error when archiving an order fails", async () => {
    vi.mocked(api.getAdminOrders).mockResolvedValue({
      items: [sampleOrder],
      totalCount: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });
    vi.mocked(api.setOrderArchived).mockRejectedValueOnce(
      new Error("Archive update failed"),
    );

    await renderAdminRoute("/admin/orders");

    fireEvent.click(await screen.findByText("customer@example.com"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Archive order" }),
    );

    expect(
      await screen.findByText("Archive update failed"),
    ).toBeInTheDocument();
  });
});
