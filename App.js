import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query } from 'firebase/firestore';

// Firebase configuration variables provided by the environment
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; // Use __app_id for Firestore paths

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Context for Auth and Firestore
const AppContext = createContext();

const AppProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setUserId(currentUser.uid);
            } else {
                setUser(null);
                setUserId(null);
            }
            setLoading(false);
        });

        // Attempt to sign in with custom token or anonymously
        const signInUser = async () => {
            if (initialAuthToken) {
                try {
                    await signInWithCustomToken(auth, initialAuthToken);
                } catch (error) {
                    console.error("Error signing in with custom token:", error);
                    // Fallback to anonymous if custom token fails
                    try {
                        await signInAnonymously(auth);
                    } catch (anonError) {
                        console.error("Error signing in anonymously:", anonError);
                    }
                }
            } else {
                try {
                    await signInAnonymously(auth);
                } catch (anonError) {
                    console.error("Error signing in anonymously:", anonError);
                }
            }
        };

        if (auth.currentUser === null) { // Only attempt sign-in if no user is currently logged in
            signInUser();
        }

        return () => unsubscribe();
    }, []);

    return (
        <AppContext.Provider value={{ user, userId, loading, auth, db }}>
            {children}
        </AppContext.Provider>
    );
};

// --- Components ---

// Admin Login Component
const AdminLogin = () => {
    const { user, auth } = useContext(AppContext);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            setMessage('Logged in as Admin!');
        }
        catch (err) {
            setError('Login failed: ' + err.message);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setMessage('Logged out.');
        }
        catch (err) {
            setError('Logout failed: ' + err.message);
        }
    };

    if (user && user.email) { // Check if user is logged in with an email (admin)
        return (
            <div className="bg-white p-6 rounded-xl shadow-lg mt-8 text-center">
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Admin Panel</h3>
                <p className="text-gray-700 mb-4">Welcome, {user.email}!</p>
                <button
                    onClick={handleLogout}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-full shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                >
                    Logout
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg mt-8">
            <h3 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Admin Login</h3>
            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                        placeholder="admin@example.com"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                        placeholder="********"
                        required
                    />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                {message && <p className="text-green-500 text-sm">{message}</p>}
                <button
                    type="submit"
                    className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-full shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                >
                    Login
                </button>
            </form>
            <p className="text-sm text-gray-500 mt-4 text-center">
                (Note: For demo, you can create an admin user in Firebase Authentication console.)
            </p>
        </div>
    );
};

// Product Form Component (Add/Edit)
const ProductForm = ({ currentProduct, setEditingProduct }) => {
    const { db, userId } = useContext(AppContext);
    const [name, setName] = useState(currentProduct ? currentProduct.name : '');
    const [category, setCategory] = useState(currentProduct ? currentProduct.category : 'Allopathic Medicines');
    const [price, setPrice] = useState(currentProduct ? currentProduct.price : '');
    const [imageUrl, setImageUrl] = useState(currentProduct ? currentProduct.imageUrl : '');
    const [description, setDescription] = useState(currentProduct ? currentProduct.description : '');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const categories = [
        'Allopathic Medicines', 'Ayurvedic Medicines', 'Homeopathic Medicines',
        'Generic Medicines', 'Veterinary Medicines', 'Unani Medicines & Maajum',
        'Syrups', 'Eye Drops', 'Body Lotions', 'Surgical Appliances',
        'Protein Powder', 'Hair Fall Serum', 'Injections',
        'Household Essentials', 'Snacks & Beverages', 'Self-care & Grooming Products',
        'Cosmetic Products', 'Baby Care Products'
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        if (!userId) {
            setError("User not authenticated for this action.");
            return;
        }

        const productData = {
            name,
            category,
            price,
            imageUrl: imageUrl || 'https://placehold.co/400x250/cccccc/333333?text=No+Image', // Default placeholder
            description,
            createdAt: currentProduct ? currentProduct.createdAt : new Date(),
            updatedAt: new Date()
        };

        try {
            if (currentProduct) {
                // Update existing product
                const productDocRef = doc(db, `artifacts/${appId}/public/data/products`, currentProduct.id);
                await updateDoc(productDocRef, productData);
                setMessage('Product updated successfully!');
                setEditingProduct(null); // Exit edit mode
            } else {
                // Add new product
                await addDoc(collection(db, `artifacts/${appId}/public/data/products`), productData);
                setMessage('Product added successfully!');
                setName('');
                setCategory('Allopathic Medicines');
                setPrice('');
                setImageUrl('');
                setDescription('');
            }
        } catch (err) {
            console.error("Error adding/updating product:", err);
            setError('Failed to save product: ' + err.message);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg mt-8">
            <h3 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
                {currentProduct ? 'Edit Product' : 'Add New Product'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                        required
                    >
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (e.g., ₹150.00)</label>
                    <input
                        type="text"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                    <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                        placeholder="https://example.com/image.jpg"
                    />
                    {imageUrl && <img src={imageUrl} alt="Product Preview" className="mt-2 h-24 w-24 object-cover rounded-md shadow-sm" onError={(e) => e.target.src='https://placehold.co/96x96/cccccc/333333?text=Error'} />}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows="3"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                        required
                    ></textarea>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                {message && <p className="text-green-500 text-sm">{message}</p>}
                <div className="flex justify-end space-x-4">
                    {currentProduct && (
                        <button
                            type="button"
                            onClick={() => setEditingProduct(null)}
                            className="bg-gray-400 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-full shadow-md transition duration-300 ease-in-out"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="submit"
                        className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-full shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                    >
                        {currentProduct ? 'Update Product' : 'Add Product'}
                    </button>
                </div>
            </form>
        </div>
    );
};

// Admin Panel Component
const AdminPanel = () => {
    const { user, db, userId } = useContext(AppContext);
    const [products, setProducts] = useState([]);
    const [editingProduct, setEditingProduct] = useState(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!db || !userId) return;

        // Firestore Security Rules:
        // For public data accessible by all users (even anonymous ones for reading products),
        // and writable only by authenticated users (for admin panel):
        // match /artifacts/{appId}/public/data/products/{documentId} {
        //   allow read: if true; // Anyone can read products
        //   allow write: if request.auth != null && request.auth.token.email != null; // Only authenticated email users can write
        // }
        // Note: For stricter admin control, you might check for a specific UID or custom claim.

        const productsCollectionRef = collection(db, `artifacts/${appId}/public/data/products`);
        const q = query(productsCollectionRef); // No orderBy to avoid index issues

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const productsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).sort((a, b) => (a.category > b.category) ? 1 : (a.category < b.category) ? -1 : (a.name > b.name) ? 1 : -1); // Client-side sort
            setProducts(productsList);
        }, (err) => {
            console.error("Error fetching products:", err);
            setError("Failed to load products: " + err.message);
        });

        return () => unsubscribe();
    }, [db, userId]);

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this product?')) {
            return;
        }
        setMessage('');
        setError('');
        if (!user || !user.email) { // Ensure only authenticated email users can delete
            setError("You must be logged in as an admin to delete products.");
            return;
        }
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/public/data/products`, id));
            setMessage('Product deleted successfully!');
        } catch (err) {
            console.error("Error deleting product:", err);
            setError('Failed to delete product: ' + err.message);
        }
    };

    if (!user || !user.email) { // Only show admin panel if logged in with email (not anonymous)
        return <AdminLogin />;
    }

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Admin Dashboard</h2>

            {message && <div className="bg-green-100 text-green-700 p-3 rounded-md mb-4">{message}</div>}
            {error && <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4">{error}</div>}

            <ProductForm currentProduct={editingProduct} setEditingProduct={setEditingProduct} />

            <div className="bg-white p-6 rounded-xl shadow-lg mt-8">
                <h3 className="text-2xl font-semibold text-gray-800 mb-6">Existing Products</h3>
                {products.length === 0 ? (
                    <p className="text-gray-600">No products added yet. Add some above!</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white rounded-lg shadow-md">
                            <thead>
                                <tr className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
                                    <th className="py-3 px-6 text-left">Image</th>
                                    <th className="py-3 px-6 text-left">Name</th>
                                    <th className="py-3 px-6 text-left">Category</th>
                                    <th className="py-3 px-6 text-left">Price</th>
                                    <th className="py-3 px-6 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-600 text-sm font-light">
                                {products.map(product => (
                                    <tr key={product.id} className="border-b border-gray-200 hover:bg-gray-50">
                                        <td className="py-3 px-6 text-left whitespace-nowrap">
                                            <img src={product.imageUrl} alt={product.name} className="w-12 h-12 object-cover rounded-md" onError={(e) => e.target.src='https://placehold.co/48x48/cccccc/333333?text=N/A'}/>
                                        </td>
                                        <td className="py-3 px-6 text-left">{product.name}</td>
                                        <td className="py-3 px-6 text-left">{product.category}</td>
                                        <td className="py-3 px-6 text-left">{product.price}</td>
                                        <td className="py-3 px-6 text-center">
                                            <div className="flex item-center justify-center space-x-2">
                                                <button
                                                    onClick={() => setEditingProduct(product)}
                                                    className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-full text-xs transition duration-300"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(product.id)}
                                                    className="bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-full text-xs transition duration-300"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </t