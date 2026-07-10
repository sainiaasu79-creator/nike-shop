import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
    customerDetails: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        address: { type: String, required: true },
        pincode: { type: String, required: true }
    },
    items: { type: Array, default: [] },
    totalAmount: { type: Number, required: true },
    paymentProof: { type: String, default: '' }, // Isme screenshot ka file path save hoga
    date: { type: Date, default: Date.now }
});

export const Order = mongoose.model('Order', orderSchema);