"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_LOGO_DIMENSION = 400;
const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const BUCKET_ID = "gym-logos";

/**
 * Resizes a selected image file to at most 400x400 px in the browser, encodes it as
 * WebP (with PNG fallback), uploads to `gym-logos/<gymId>/logo.webp`, and returns
 * a cache-busted public URL. Optionally persists `logo_url` on the `gyms` row.
 */
export async function uploadGymLogo(
  supabase: SupabaseClient,
  gymId: string,
  file: File,
  options: { updateGymRow?: boolean } = { updateGymRow: true },
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select a PNG, JPG, or WebP image file.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Logo image must be 5 MB or smaller.");
  }

  const { blob, ext, contentType } = await resizeLogoImage(file);
  const path = `${gymId}/logo.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET_ID)
    .upload(path, blob, { contentType, upsert: true });

  if (uploadErr) {
    throw new Error(uploadErr.message);
  }

  const { data } = supabase.storage.from(BUCKET_ID).getPublicUrl(path);
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

  if (options.updateGymRow !== false) {
    const { error: updateErr } = await supabase
      .from("gyms")
      .update({ logo_url: publicUrl })
      .eq("id", gymId);

    if (updateErr) {
      throw new Error(updateErr.message);
    }
  }

  return publicUrl;
}

async function resizeLogoImage(file: File): Promise<{
  blob: Blob;
  ext: string;
  contentType: string;
}> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      MAX_LOGO_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return {
        blob: file,
        ext: file.type === "image/png" ? "png" : "webp",
        contentType: file.type,
      };
    }

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const webpBlob = await canvasToBlob(canvas, "image/webp", 0.88);
    if (webpBlob && webpBlob.type === "image/webp") {
      return { blob: webpBlob, ext: "webp", contentType: "image/webp" };
    }

    const pngBlob = await canvasToBlob(canvas, "image/png", 0.92);
    if (pngBlob) {
      return { blob: pngBlob, ext: "png", contentType: "image/png" };
    }

    return {
      blob: file,
      ext: "png",
      contentType: file.type || "image/png",
    };
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}
