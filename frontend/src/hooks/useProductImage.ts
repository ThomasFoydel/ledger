import { useCallback, useEffect, useState } from "react";

export function useProductImage() {
  const [pendingProductImageFile, setPendingProductImageFile] = useState<File | null>(null);
  const [productImagePreviewUrl, setProductImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (productImagePreviewUrl) URL.revokeObjectURL(productImagePreviewUrl);
    };
  }, [productImagePreviewUrl]);

  const clearProductImage = useCallback(() => {
    setPendingProductImageFile(null);
    setProductImagePreviewUrl(null);
  }, []);

  function handleSelectProductImage(
    file: File | undefined,
    setError: (message: string) => void,
  ) {
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      clearProductImage();
      setError("Choose a PNG, JPEG, or WebP product image.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      clearProductImage();
      setError("Product images must be 2 MB or smaller.");
      return;
    }

    setPendingProductImageFile(file);
    setProductImagePreviewUrl(URL.createObjectURL(file));
    setError("");
  }

  return {
    pendingProductImageFile,
    productImagePreviewUrl,
    clearProductImage,
    handleSelectProductImage,
  };
}
