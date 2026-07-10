import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    title: { type: String, required: true },
    price: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    category: { type: String, required: true },
    gender: {
        type: String,
        enum: ['male', 'female', 'boy', 'girl'],
        required: true
    },
    sizes: {
        type: [String],
        default: []
    },
    emoji: {
        type: String,
        default: '📦'
    },
    description: {
        type: String,
        required: true
    },

    // Main image
    image: {
        type: String,
        default: '/uploads/default.jpg'
    },

    // Multiple gallery images
    images: {
        type: [String],
        default: []
    }

}, { timestamps: true });

export const Product = mongoose.model('Product', productSchema);