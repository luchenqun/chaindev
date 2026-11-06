export const MAX_QR_TEXT_BYTES = 2300;
export const MAX_QR_IMAGE_BYTES = 20 * 1024 * 1024;

export async function generateQrCode(text: string) {
  if (!text) {
    throw new Error('QR_EMPTY_TEXT');
  }

  if (new TextEncoder().encode(text).length > MAX_QR_TEXT_BYTES) {
    throw new Error('QR_TEXT_TOO_LONG');
  }

  const { default: qrcode } = await import('qrcode-generator');
  qrcode.stringToBytes = (value) => Array.from(new TextEncoder().encode(value));
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();

  const margin = 4;
  const count = qr.getModuleCount();
  const scale = Math.max(4, Math.ceil(320 / (count + margin * 2)));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = (count + margin * 2) * scale;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('QR_CANVAS_UNAVAILABLE');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000000';

  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (qr.isDark(row, column)) {
        context.fillRect((column + margin) * scale, (row + margin) * scale, scale, scale);
      }
    }
  }

  return canvas.toDataURL('image/png');
}

export async function decodeQrCode(imageUrl: string) {
  const image = new Image();
  image.src = imageUrl;

  try {
    await image.decode();
  } catch {
    throw new Error('QR_INVALID_IMAGE');
  }

  const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('QR_CANVAS_UNAVAILABLE');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const { default: jsQR } = await import('jsqr');
  const result = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' });

  if (!result) {
    throw new Error('QR_NOT_FOUND');
  }

  return result.data;
}
