export type UserRole = 'customer' | 'admin' | 'super_admin';
export type SaleType = 'unit' | 'kg' | 'both';
export type UnitMode = 'unit' | 'kg';
export type OrderStatus =
  | 'pending_payment'
  | 'awaiting_confirmation'
  | 'paid'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  cpf: string;
  phone: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string | null;
  additional_categories?: string[] | null;
  subcategory?: string | null;
  image_url: string | null;
  image_path?: string | null;
  sale_type: SaleType;
  price_unit: number | null;
  promo_price_unit: number | null;
  price_kg: number | null;
  promo_price_kg: number | null;
  sort_price: number;
  manage_stock: boolean;
  stock_quantity: number | null;
  is_active: boolean;
  is_promo?: boolean;
  avg_rating?: number | null;
  review_count?: number;
  created_at?: string;
}

export interface ProductReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  authorName: string;
}

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  imageUrl: string | null;
  unitMode: UnitMode;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  manageStock: boolean;
  stockQuantity: number | null;
}

export interface CartState {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

export interface PendingCartIntent {
  productId: string;
  productName: string;
  unitMode: UnitMode;
  quantity: number;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image_url: string | null;
  unit_mode: UnitMode;
  quantity: number;
  unit_price: number;
  line_total: number;
  my_review?: {
    rating: number;
    comment: string;
    created_at: string;
  } | null;
}

export type PaymentMethodCode =
  | 'pix'
  | 'card'
  | 'credit_card'
  | 'debit_card'
  | 'cash_on_delivery';

export type PaymentChannel = 'online' | 'on_delivery';

export interface OrderPaymentDetails {
  selectedMethod?: string;
  channel?: PaymentChannel;
  label?: string;
  changeFor?: string | null;
  installments?: number;
  cardBrand?: string | null;
  cardLastFour?: string | null;
  mpStatus?: string;
  mpStatusDetail?: string | null;
  awaitingWebhook?: boolean;
  webhookVerified?: boolean;
  deliveryMode?: DeliveryMode;
  pickupNotice?: string;
  note?: string;
}

export type DeliveryMode = 'delivery' | 'pickup';

export interface OrderPayment {
  id: string;
  method: PaymentMethodCode | string;
  status: string;
  amount: number;
  provider: string | null;
  provider_reference?: string | null;
  details: OrderPaymentDetails | null;
}

export interface OrderRecord {
  id: string;
  order_number: number;
  user_id?: string;
  status: OrderStatus;
  delivery_mode?: DeliveryMode;
  subtotal: number;
  shipping_fee: number;
  total: number;
  shipping_cep: string;
  shipping_street: string;
  shipping_number: string;
  shipping_complement: string | null;
  shipping_neighborhood: string;
  shipping_city: string;
  shipping_state: string;
  customer_name?: string;
  customer_cpf?: string;
  customer_phone?: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  order_items: OrderItem[];
  payments: OrderPayment[] | OrderPayment | null;
}

export interface AdminUserRow {
  id: string;
  full_name: string;
  email: string;
  cpf: string;
  phone: string;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
}

export interface StoreConfig {
  storeName: string;
  storeDescription: string;
  whatsappNumber: string;
  paymentConfigured: boolean;
  onlineCardConfigured?: boolean;
  mpPublicKey?: string;
  paymentProvider?: string | null;
  supabaseConfigured: boolean;
}
