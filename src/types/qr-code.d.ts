declare module 'jsqr' {
  type Point = {
    x: number;
    y: number;
  };

  type Options = {
    inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst';
  };

  type Result = {
    data: string;
    binaryData: number[];
    chunks: unknown[];
    version: number;
    location: {
      topRightCorner: Point;
      topLeftCorner: Point;
      bottomRightCorner: Point;
      bottomLeftCorner: Point;
      topRightFinderPattern: Point;
      topLeftFinderPattern: Point;
      bottomLeftFinderPattern: Point;
      bottomRightAlignmentPattern?: Point;
    };
  };

  const jsQR: (
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: Options,
  ) => Result | null;

  export default jsQR;
}

declare module 'qrcode-generator' {
  type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

  type QrCode = {
    addData(data: string, mode?: 'Numeric' | 'Alphanumeric' | 'Byte' | 'Kanji'): void;
    make(): void;
    getModuleCount(): number;
    isDark(row: number, column: number): boolean;
  };

  type QrCodeGenerator = {
    (typeNumber: number, errorCorrectionLevel: ErrorCorrectionLevel): QrCode;
    stringToBytes: (value: string) => number[];
  };

  const qrcode: QrCodeGenerator;
  export default qrcode;
}
