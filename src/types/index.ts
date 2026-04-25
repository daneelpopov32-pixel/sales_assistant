export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  characteristics?: Record<string, string>;
}

export interface Discount {
  id: string;
  code: string;
  description: string;
  discountPercent: number;
  validUntil: Date;
  isActive: boolean;
}

export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  sessionId: string;
  items: CartItem[];
  totalAmount: number;
  discount?: Discount;
  status: 'pending' | 'paid' | 'cancelled';
  createdAt: Date;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export type Intent = 
  | 'greeting'
  | 'product_inquiry'
  | 'price_inquiry'
  | 'comparison'
  | 'objection'
  | 'purchase_intent'
  | 'discount_request'
  | 'chitchat'
  | 'goodbye';

export interface DialogContext {
  currentIntent?: Intent;
  selectedProducts?: Product[];
  cart?: CartItem[];
  appliedDiscount?: Discount;
  awaitingConfirmation?: boolean;
  lastQuery?: string;
}

export interface DialogState {
  sessionId: string;
  userId?: string;
  history: Message[];
  context: DialogContext;
  createdAt: Date;
  updatedAt: Date;
}

export interface Summary {
  sessionId: string;
  customerInfo: {
    name?: string;
    email?: string;
    phone?: string;
    interests: string[];
  };
  discussedProducts: Product[];
  objections: string[];
  finalIntent: Intent;
  recommendedActions: string[];
  transcript: Message[];
  createdAt: Date;
}

export interface WebhookRequest {
  sessionId: string;
  message: string;
  userId?: string;
  userName?: string;
}

export interface WebhookResponse {
  response: string;
  timestamp: string;
}