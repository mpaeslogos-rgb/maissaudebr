/**
 * Validador de Boleto Brasileiro (Padrão FEBRABAN)
 * 
 * Linha digitável (47 dígitos):
 * AAABC.CCCCX DDDDD.DDDDDY EEEEE.EEEEEZ K UUUUVVVVVVVVVV
 */

export interface ParsedBoleto {
  barcode: string;
  bankCode: string;
  amount: number;
  dueDate: string;
  isValid: boolean;
}

export function parseDigitableLine(line: string): ParsedBoleto | null {
  const digits = line.replace(/\D/g, "");
  
  if (digits.length !== 47) return null;

  const barcode = digitableToBarcode(digits);
  if (!barcode) return null;

  const bankCode = barcode.substring(0, 3);
  const dueFactor = parseInt(barcode.substring(5, 9), 10);
  const dueDate = factorToDate(dueFactor);

  const amountStr = barcode.substring(9, 19);
  const amount = parseInt(amountStr, 10) / 100;

  const isValid = validateBarcodeDV(barcode);

  return {
    barcode,
    bankCode,
    amount,
    dueDate,
    isValid,
  };
}

function digitableToBarcode(line: string): string | null {
  if (line.length !== 47) return null;

  const campo1 = line.substring(0, 9);
  const campo2 = line.substring(10, 20);
  const campo3 = line.substring(21, 31);
  const dvGeral = line.substring(32, 33);
  const campo5 = line.substring(33, 47);

  const barcode =
    campo1.substring(0, 4) +
    dvGeral +
    campo5 +
    campo1.substring(4, 9) +
    campo2 +
    campo3;

  return barcode.length === 44 ? barcode : null;
}

function factorToDate(factor: number): string {
  const baseDate = new Date(1997, 9, 7);
  const baseFactor = 1000;
  const diffDays = factor - baseFactor;
  
  const result = new Date(baseDate);
  result.setDate(result.getDate() + diffDays);
  
  return result.toISOString().split("T")[0];
}

function validateBarcodeDV(barcode: string): boolean {
  if (barcode.length !== 44) return false;

  const dvInformed = parseInt(barcode[4], 10);
  const sequence = barcode.substring(0, 4) + barcode.substring(5);

  let sum = 0;
  let weight = 2;
  
  for (let i = sequence.length - 1; i >= 0; i--) {
    sum += parseInt(sequence[i], 10) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const remainder = sum % 11;
  let dvCalculated = 11 - remainder;
  
  if (dvCalculated === 0 || dvCalculated === 10 || dvCalculated === 11) {
    dvCalculated = 1;
  }

  return dvCalculated === dvInformed;
}

export function validateBoleto(digitableLine: string): boolean {
  const parsed = parseDigitableLine(digitableLine);
  return parsed?.isValid || false;
}

export function formatDigitableLine(line: string): string {
  const d = line.replace(/\D/g, "");
  if (d.length !== 47) return line;
  
  return `${d.substring(0, 5)}.${d.substring(5, 10)} ${d.substring(10, 15)}.${d.substring(15, 21)} ${d.substring(21, 26)}.${d.substring(26, 32)} ${d.substring(32, 33)} ${d.substring(33, 47)}`;
}
