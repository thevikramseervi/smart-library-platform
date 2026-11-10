import QRCode from "qrcode";

/** Create the student library QR; its encoded value is only the student code. */
export function generateStudentQrCode(studentCode: string): Promise<string> {
  return QRCode.toDataURL(studentCode, {
    width: 320,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
