import QRCode from 'qrcode';

/**
 * Utilitário para cálculo de CRC16-CCITT para o padrão Pix BACEN
 */
function crc16(str: string): string {
  let crc = 0xffff;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  const hex = (crc & 0xffff).toString(16).toUpperCase();
  return hex.padStart(4, '0');
}

function formatField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

export interface PixPayloadParams {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  txId: string;
  amountCents: number;
}

/**
 * Gera a string Pix Copia e Cola conforme especificação do Banco Central do Brasil
 */
export function generatePixPayload(params: PixPayloadParams): string {
  const amountStr = (params.amountCents / 100).toFixed(2);
  const cleanName = params.merchantName.substring(0, 25).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cleanCity = params.merchantCity.substring(0, 15).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cleanTxId = params.txId.replace(/[^A-Za-z0-9]/g, '').substring(0, 25) || 'PIXTRANS';

  // 26: Merchant Account Information
  const gui = formatField('00', 'br.gov.bcb.pix');
  const key = formatField('01', params.pixKey);
  const merchantAccountInfo = formatField('26', `${gui}${key}`);

  // 62: Additional Data Field (TXID)
  const txIdField = formatField('05', cleanTxId);
  const additionalData = formatField('62', txIdField);

  let raw = '';
  raw += formatField('00', '01'); // Payload Format Indicator
  raw += merchantAccountInfo;
  raw += formatField('52', '0000'); // Merchant Category Code
  raw += formatField('53', '986'); // BRL Currency
  raw += formatField('54', amountStr);
  raw += formatField('58', 'BR'); // Country
  raw += formatField('59', cleanName);
  raw += formatField('60', cleanCity);
  raw += additionalData;
  raw += '6304'; // CRC16 Header

  const crc = crc16(raw);
  return `${raw}${crc}`;
}

/**
 * Gera o QR Code visual em Base64 Data URL a partir do payload Pix
 */
export async function generatePixQrCodeDataUrl(pixPayload: string): Promise<string> {
  return await QRCode.toDataURL(pixPayload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 8,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}
