export interface Product {
  id: string;
  name: string;
  price: number; // in XOF (FCFA) by default or any config
  description: string;
  category: string;
  image: string;
  stock: string[]; // List of accounts, keys, or links. Popped on purchase.
}

export interface PaymentMethod {
  id: string;
  name: string;
  logo: string; // orange | mtn | moov | wave | other
  number: string; // phone number or payment details
  holder: string; // name of owner
  instructions: string; // step by step guides
}

export interface Country {
  code: string; // BF, CI, SN, ML, etc.
  name: string;
  paymentMethods: PaymentMethod[];
}

export type TransactionStatus = 'pending' | 'approved' | 'rejected';

export interface Transaction {
  id: string;
  productId: string;
  productName: string;
  amount: number;
  countryCode: string;
  paymentMethodId: string;
  email: string;
  whatsapp: string;
  receiptImage: string; // path to stored file or base64 URL
  status: TransactionStatus;
  deliveredItem: string | null; // The code or key popped from stock
  createdAt: string;
  verifiedAt?: string;
  isPendingManualDelivery?: boolean; // If approved but stock was empty
  errorMessage?: string; // Reason for rejection or validation error
}

export interface Subscriber {
  email: string;
  createdAt: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export interface AppConfig {
  adminPassword?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  supportTelegram?: string;
  smtpConfig?: SmtpConfig;
}

export interface DatabaseSchema {
  products: Product[];
  countries: Country[];
  transactions: Transaction[];
  subscribers: Subscriber[];
  config: AppConfig;
}
