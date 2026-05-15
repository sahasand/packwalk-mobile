interface UploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

interface UploadResult {
  url: string;
  publicId: string;
}

export async function uploadImageWithSignature(
  imageUri: string,
  signatureData: UploadSignature
): Promise<UploadResult> {
  const formData = new FormData();

  // Handle different URI formats (web blob vs native file)
  if (imageUri.startsWith('data:') || imageUri.startsWith('blob:')) {
    // Web: fetch blob and append
    const response = await fetch(imageUri);
    const blob = await response.blob();
    formData.append('file', blob, 'image.jpg');
  } else {
    // Native: use file URI directly
    const filename = imageUri.split('/').pop() || 'image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('file', {
      uri: imageUri,
      name: filename,
      type,
    } as any);
  }

  formData.append('api_key', signatureData.apiKey);
  formData.append('timestamp', signatureData.timestamp.toString());
  formData.append('signature', signatureData.signature);
  formData.append('folder', signatureData.folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cloudinary upload failed: ${error}`);
  }

  const data = await response.json();

  return {
    url: data.secure_url,
    publicId: data.public_id,
  };
}
