import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer'; 
import fs from 'fs';
import { Product } from './product.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares - Must be before routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: [
       "https://sainiaasu79-creator.github.io/nike-shop/"
    ],
    credentials: true
}));

// 📦 Uploads directory configuration
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// 📦 Multer Disk Storage for Images (Products and Payment Proofs)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// EJS Template Configuration
app.set('view engine', 'ejs');
app.set('views', __dirname);

// Secure Session
app.use(session({
    secret: 'nike_secret_key_2026',
    resave: false,
    saveUninitialized: true
}));

// MongoDB Connection
// पुराना कोड हटाकर ये लिखें:
const dbURI = process.env.MONGODB_URI || "यहाँ अपनी MongoDB Atlas वाली पूरी URL पेस्ट कर दें";
mongoose.connect(dbURI)
    .then(() => console.log('✓ MongoDB Connected Successfully!'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// 📦 Order Schema & Model
const orderSchema = new mongoose.Schema({
    customerDetails: {
        name: { type: String, required: true },
        phone: String,      
        mobile: String,     
        state: String,
        district: String,
        city: String,
        pinCode: String,    
        pincode: String,    
        address: { type: String, required: true }
    },
    items: [{
        productId: String,
        title: String,
        price: Number,
        quantity: Number,
        size: String,
        image: String 
    }],
    totalAmount: { type: Number, required: true },
    paymentMethod: String,
    paymentProof: { type: String, default: '' }, 
    status: { type: String, default: 'ordered' },
    cancellationReason: { type: String, default: "" },
    date: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

// Middleware to protect routes
const isAdmin = (req, res, next) => {
    if (req.session.isAdmin) return next();
    res.redirect('/admin/login');
};

// ================= ADMIN ROUTING =================
app.get('/admin/login', (req, res) => res.render('login'));

app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        req.session.isAdmin = true;
        return res.redirect('/admin/dashboard');
    }
    res.send("<h2>Invalid Credentials! Back ja kar firse try karein.</h2>");
});

// Delete Product Route
app.get('/admin/delete-product/:id', isAdmin, async (req, res) => {
    try {
        const productId = req.params.id;
        await Product.findByIdAndDelete(productId);
        console.log(`Product with ID ${productId} deleted successfully.`);
        res.redirect('/admin/dashboard');
    } catch (err) {
        res.status(500).send("Error deleting product: " + err.message);
    }
});

// Admin Dashboard - Real orders model mapping
app.get('/admin/dashboard', isAdmin, async (req, res) => {
    try {
        const products = await Product.find();
        const orders = await Order.find().sort({ date: -1 }); 
        res.render('dashboard', { products, orders });
    } catch (err) {
        res.status(500).send("Dashboard Error: " + err.message);
    }
});

// Add Product Route with Multiple Images support (max 5 images)
app.post('/admin/add-product', isAdmin, upload.array('images', 5), async (req, res) => {
    try {
        let { title, price, discount, gender, category, sizes, description } = req.body;
        
        if (!title || !price || !gender || !category || !description) {
            return res.status(400).send("Error: Saari required fields bharna zaroori hai.");
        }

        let finalSizes = [];
        if (sizes) {
            if (Array.isArray(sizes)) {
                finalSizes = sizes.map(s => s.trim()).filter(s => s !== "");
            } else if (typeof sizes === 'string') {
                finalSizes = sizes.split(',').map(sz => sz.trim()).filter(sz => sz !== "");
            }
        }

        if (finalSizes.length === 0) {
            if (category === 'shoes') finalSizes = ['6', '7', '8', '9', '10'];
            else if (category === 'pants' || category === 'shorts') finalSizes = ['30', '32', '34'];
            else finalSizes = ['S', 'M', 'L', 'XL'];
        }

        let imagePaths = [];
        if (req.files && req.files.length > 0) {
            imagePaths = req.files.map(file => `/uploads/${file.filename}`);
        } else {
            imagePaths = ['/uploads/default.jpg'];
        }

        const newProduct = new Product({
            title: title.trim(),
            price: Number(price),
            discount: Number(discount) || 0,
            gender,
            category,
            sizes: finalSizes,
            description: description.trim(),
            image: imagePaths[0],
            images: imagePaths
        });

        await newProduct.save();
        res.redirect('/admin/dashboard');
    } catch (err) {
        res.status(500).send("Error adding product to DB: " + err.message);
    }
});

// 🛠️ NEW: एडमिन द्वारा ऑर्डर का स्टेटस अपडेट करने का API
app.patch('/api/admin/orders/status/:id', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const updatedOrder = await Order.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        res.json({ success: true, message: "Status updated successfully", order: updatedOrder });
    } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

// ================= API ENDPOINTS FOR FRONTEND =================
app.post('/api/user-orders', async (req, res) => {
    try {
        const { name, phone } = req.body;
        if (!name || !phone) {
            return res.json({ success: false, message: "Name aur Mobile Number required hai." });
        }
        const orders = await Order.find({
            "customerDetails.name": { $regex: new RegExp("^" + name.trim() + "$", "i") },
            $or: [
                { "customerDetails.phone": phone.trim() },
                { "customerDetails.mobile": phone.trim() }
            ]
        }).sort({ date: -1 });
        res.json({ success: true, orders });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get All Products
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ _id: -1 });
        res.json(products);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API POST ROUTE FOR CLIENT CHECKOUT WITH SCREENSHOT UPLOAD
app.post('/api/orders', upload.single('paymentProof'), async (req, res) => {
    try {
        const { name, phone, mobile, state, district, city, pincode, pinCode, address, items, totalAmount, paymentMethod } = req.body;
        const proofPath = req.file ? `/uploads/${req.file.filename}` : '';

        let parsedItems = [];
        if (items) {
            try {
                parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
            } catch (e) {
                console.error("Items parse karne me error:", e);
                parsedItems = [];
            }
        }

        const orderData = {
            customerDetails: {
                name: name,
                phone: phone || mobile,
                mobile: mobile || phone,
                state: state,
                district: district,
                city: city,
                pincode: pincode || pinCode,
                pinCode: pinCode || pincode,
                address: address
            },
            items: parsedItems,
            totalAmount: Number(totalAmount),
            paymentMethod: paymentMethod || 'Online QR',
            paymentProof: proofPath
        };

        const newOrder = new Order(orderData);
        const savedOrder = await newOrder.save();
        
        console.log("✓ New Order Received & Saved with Screenshot Proof:", savedOrder);
        res.status(201).json({ success: true, order: savedOrder });
    } catch (error) {
        console.error("Backend order save error:", error);
        res.status(500).json({ success: false, error: "Order save karne mein dikkat aayi: " + error.message });
    }
});

// 1. User orders endpoint 
app.get('/api/user-orders', async (req, res) => {
    try {
        const name = req.query.name;
        const phone = req.query.phone;

        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                message: "Name aur phone required hai."
            });
        }

        const queryCondition = {
            "customerDetails.name": { $regex: new RegExp("^" + name.trim() + "$", "i") },
            $or: [
                { "customerDetails.phone": phone.trim() },
                { "customerDetails.mobile": phone.trim() }
            ]
        };

        const orders = await Order.find(queryCondition).sort({ date: -1 });

        res.json({
            success: true,
            orders: orders
        });
        
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// 2. User side se order cancel karne ka endpoint
app.patch('/api/orders/cancel/:id', async (req, res) => {
    try {
        const { reason, name, phone } = req.body;

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid Order ID." });
        }
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Customer name is required." });
        }
        if (!phone || !phone.trim()) {
            return res.status(400).json({ success: false, message: "Customer phone is required." });
        }
        if (reason && reason.trim().length > 300) {
            return res.status(400).json({ success: false, message: "Cancellation reason is too long." });
        }

        const order = await Order.findOne({
            _id: req.params.id,
            "customerDetails.name": { $regex: new RegExp("^" + name.trim() + "$", "i") },
            $or: [
                { "customerDetails.phone": phone.trim() },
                { "customerDetails.mobile": phone.trim() }
            ]
        });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found or you are not authorized." });
        }
        if (order.status === "cancelled") {
            return res.status(400).json({ success: false, message: "Order already cancelled." });
        }
        if (order.status === "delivered") {
            return res.status(400).json({ success: false, message: "Delivered order cannot be cancelled." });
        }

        order.status = "cancelled";
        order.cancellationReason = reason || "Customer cancelled the order.";

        await order.save();
        res.json({ success: true, order });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// App Listen
const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server Running on http://0.0.0.0:${PORT}`);
});
