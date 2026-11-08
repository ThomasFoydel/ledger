import { useCallback, useState } from "react";
import { useProductImage } from "./useProductImage";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import {
  createProduct,
  deleteProduct,
  getProductTags,
  uploadProductImage,
  updateProduct,
  type Product,
  type ProductInput,
} from "../api";

type UseProductManagementOptions = {
  isAdminProductsRoute: boolean;
  navigate: NavigateFunction;
  setProducts: Dispatch<SetStateAction<Product[]>>;
  setError: Dispatch<SetStateAction<string>>;
  setSubmitting: Dispatch<SetStateAction<boolean>>;
  loadProducts: () => Promise<void>;
  loadAdminProducts: () => Promise<void>;
  onProductImageUpdated: () => void;
};

const emptyProduct: ProductInput = {
  name: "",
  description: "",
  price: 0,
  quantityOnHand: 0,
  tags: [],
};

export function useProductManagement({
  isAdminProductsRoute,
  navigate,
  setProducts,
  setError,
  setSubmitting,
  loadProducts,
  loadAdminProducts,
  onProductImageUpdated,
}: UseProductManagementOptions) {
  const [form, setForm] = useState<ProductInput>(emptyProduct);
  const [priceDraft, setPriceDraft] = useState("0");
  const [quantityDraft, setQuantityDraft] = useState("0");
  const [editingId, setEditingId] = useState<string | null>(null);
  const {
    pendingProductImageFile,
    productImagePreviewUrl,
    clearProductImage,
    handleSelectProductImage: selectProductImage,
  } = useProductImage();

  const resetForm = useCallback(() => {
    setForm(emptyProduct);
    setPriceDraft("0");
    setQuantityDraft("0");
    setEditingId(null);
    clearProductImage();
  }, [clearProductImage]);

  const startEditing = useCallback(
    async (product: Product) => {
      setError("");

      try {
        const tags = await getProductTags(product.id);

        setForm({
          name: product.name,
          description: product.description ?? "",
          price: product.price,
          quantityOnHand: product.quantityOnHand,
          tags,
        });
        setPriceDraft(String(product.price));
        setQuantityDraft(String(product.quantityOnHand));
        setEditingId(product.id);
        clearProductImage();
        navigate("/admin/products", { replace: true, state: null });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load this product's search tags.",
        );
      }
    },
    [clearProductImage, navigate, setError],
  );

  function handleSelectProductImage(file: File | undefined) {
    selectProductImage(file, setError);
  }

  async function handleSaveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const price = Number(priceDraft);
    const quantityOnHand = Number(quantityDraft);

    if (
      priceDraft.trim() === "" ||
      !Number.isFinite(price) ||
      price < 0 ||
      price > 99999999.99
    ) {
      setError("Enter a valid price between 0 and 99,999,999.99.");
      return;
    }

    if (
      quantityDraft.trim() === "" ||
      !Number.isInteger(quantityOnHand) ||
      quantityOnHand < 0
    ) {
      setError("Enter a valid whole number for quantity on hand.");
      return;
    }

    setSubmitting(true);

    const input: ProductInput = {
      name: form.name.trim(),
      description: form.description.trim(),
      price,
      quantityOnHand,
      tags: form.tags.map((tag) => tag.trim()).filter(Boolean),
    };

    let productSaved = false;
    let imageUploadFailed = false;

    try {
      const savedProduct = editingId
        ? await updateProduct(editingId, input)
        : await createProduct(input);

      productSaved = true;

      // Keep the newly created product ID if image upload fails.
      setEditingId(savedProduct.id);

      if (pendingProductImageFile) {
        try {
          await uploadProductImage(
            savedProduct.id,
            pendingProductImageFile,
          );
          onProductImageUpdated();
        } catch (err) {
          imageUploadFailed = true;
          throw err;
        }
      }

      await loadProducts();
      if (isAdminProductsRoute) await loadAdminProducts();
      resetForm();
    } catch (err) {
      if (productSaved) {
        try {
          await loadProducts();
          if (isAdminProductsRoute) await loadAdminProducts();
        } catch {
          // Preserve the original save or upload error.
        }

        const message =
          err instanceof Error ? err.message : "An unexpected error occurred.";

        setError(
          imageUploadFailed
            ? `Product details were saved, but the image upload failed: ${message}`
            : `Product details were saved, but the catalog refresh failed: ${message}`,
        );
      } else {
        setError(
          err instanceof Error ? err.message : "Unable to save product.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const handleDeleteProduct = useCallback(
    async (product: Product) => {
      if (!window.confirm(`Delete "${product.name}"?`)) return;

      setError("");
      setSubmitting(true);

      try {
        await deleteProduct(product.id);
        setProducts((current) =>
          current.filter((item) => item.id !== product.id),
        );

        if (isAdminProductsRoute) await loadAdminProducts();

        if (editingId === product.id) resetForm();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to delete product.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      editingId,
      isAdminProductsRoute,
      loadAdminProducts,
      resetForm,
      setError,
      setProducts,
      setSubmitting,
    ],
  );


  return {
    form,
    setForm,
    priceDraft,
    setPriceDraft,
    quantityDraft,
    setQuantityDraft,
    editingId,
    pendingProductImageFile,
    productImagePreviewUrl,
    resetForm,
    startEditing,
    handleSelectProductImage,
    handleSaveProduct,
    handleDeleteProduct,
  };
}
