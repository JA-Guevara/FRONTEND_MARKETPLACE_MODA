export interface CartItem { variant_id:string; product_id:string; name:string; sku:string; size:string; color:string; image_url:string|null; unit_price:string; quantity:number; available:number; line_total:string }
export interface Cart { items:CartItem[]; total:string; currency:string }
export interface Branch { id:string; name:string; address:string }
export interface DeliveryAddress { recipient:string; phone:string; line1:string; city:string; country:string; postal_code?:string }
export interface Order { id:string; number:string; customer_email:string; status:string; payment_status:string; payment_method:string; payment_reference:string|null; total:string; currency:string; address:DeliveryAddress; items:CartItem[]; tracking:{status:string;note:string;date:string}[]; carrier:string|null; tracking_number:string|null; created_at:string }
export const commerceLabel = (value:string):string => ({pending_payment:'Pendiente de pago',paid:'Pagado',processing:'En preparación',shipped:'En camino',delivered:'Entregado',cancelled:'Cancelado',expired:'Vencido',pending:'Pendiente',stripe:'Tarjeta · Stripe',manual:'Pago coordinado',cash:'Efectivo',transfer:'Transferencia'}[value] || value);
