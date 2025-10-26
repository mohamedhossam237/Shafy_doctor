/**
 * Uploads an image to Imgbb and returns the hosted URL.
 * Requires the IMGBB_API_KEY to be set in your .env.local
 * @param {File|Blob} file - image file
 * @returns {Promise<string>} hosted image URL
 */
export async function uploadImageToImgbb(file) {
  if (!file) throw new Error('No file selected');
  const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
  if (!apiKey) throw new Error('Imgbb API key missing');

  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: 'POST',
    body: formData,
  });

  const json = await res.json();

  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message || 'Upload failed');
  }

  return json.data.url;
}

/**
 * Converts base64 or image URL to a Blob for Imgbb upload
 * @param {string} imageSrc
 * @returns {Promise<Blob>}
 */
export async function imageToBlob(imageSrc) {
  const res = await fetch(imageSrc);
  if (!res.ok) throw new Error('Failed to fetch image');
  return await res.blob();
}

/**
 * Convenience helper: uploads a base64 string directly
 * @param {string} base64String
 * @returns {Promise<string>} hosted image URL
 */
export async function uploadBase64ToImgbb(base64String) {
  const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
  if (!apiKey) throw new Error('Imgbb API key missing');

  const formData = new FormData();
  formData.append('image', base64String.split(',')[1]); // remove "data:image/jpeg;base64,"

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: 'POST',
    body: formData,
  });

  const json = await res.json();

  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message || 'Upload failed');
  }

  return json.data.url;
}
