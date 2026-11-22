declare module 'qrcode' {
  const QRCode: {
    create(text: string, options?: { errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' }): { modules: { size: number; get(x: number, y: number): boolean | number } };
    toDataURL(text: string, options?: {errorCorrectionLevel?: 'L'|'M'|'Q'|'H';margin?:number;width?:number}): Promise<string>;
  };
  export default QRCode;
}
