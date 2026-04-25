export interface Order {
    order_id: string;
    customer_id: string;
    product_id: string;
    order_amount: string;
    order_date: string;
    payment_method: string;
    status: string;
    quantity: string;
}
export interface Customer {
    customer_id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    gender: string;
    dob: string;
    signup_date: string;
    address: string;
    city: string;
    state: string;
    country: string;
}
export declare class OrderDatabase {
    private orders;
    private customers;
    constructor();
    private loadOrders;
    private loadCustomers;
    findCustomerByContact(contact: string): Customer | null;
    getOrdersByCustomerId(customerId: string): Order[];
    getOrderCountByContact(contact: string): number;
    getTotalSpentByContact(contact: string): number;
    getCustomerStats(customerId: string): {
        totalOrders: number;
        totalSpent: number;
        statuses: Record<string, number>;
        lastOrder: Order | null;
    };
    formatCustomerStats(customer: Customer, customerId: string): string;
    getOrderById(orderId: string): Order | null;
    formatOrderInfo(order: Order): string;
}
//# sourceMappingURL=orderDatabase.d.ts.map