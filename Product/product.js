const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const app = express();
app.use(express.json());

const config = require('./config');
const uri = config.mongodbUri;       

const client = new MongoClient(uri);

const dbName = "day-15";
const collectionName = "products";

class Product 
{
    constructor(name, price, stock, category = null) 
    {
        this.name = name;
        this.price = price;
        this.stock = stock;
        this.category = category;
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    validate() 
    {
        const errors = [];
        
        if (!this.name || typeof this.name !== 'string' || this.name.trim().length === 0) {
            errors.push('Product name is required and must be a non-empty string');
        }
        
        if (!this.price || typeof this.price !== 'number' || this.price <= 0) {
            errors.push('Product price is required and must be a positive number');
        }
        
        if (this.stock === undefined || this.stock === null || typeof this.stock !== 'number' || this.stock < 0) {
            errors.push('Product stock is required and must be a non-negative number');
        }
        
        return errors;
    }

    toJSON() 
    {
        return {
            name: this.name,
            price: this.price,
            stock: this.stock,
            category: this.category,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

async function connectToMongoDB() 
{
    try 
    {
        await client.connect();
        console.log("Connected to MongoDB Atlas");
        db = client.db(dbName);
        productCollection = db.collection(collectionName);
        
        await productCollection.createIndex({ name: 1 }, { unique: true });
        await productCollection.createIndex({ price: 1 });
        await productCollection.createIndex({ stock: 1 });
        
        const count = await productCollection.countDocuments();
        if (count === 0) 
            {
            await seedInitialData();
        }
    } 
    
    catch (error) 
    {
        console.error("MongoDB connection error:", error.message);
        process.exit(1);
    }
}

async function seedInitialData() 
{
    try 
    {
        const initialProducts = [
            new Product('Laptop', 999.99, 50, 'Electronics'),
            new Product('T-Shirt', 19.99, 200, 'Clothing'),
            new Product('Coffee Mug', 12.50, 150, 'Home & Kitchen'),
            new Product('Smartphone', 699.99, 100, 'Electronics'),
            new Product('Desk Chair', 249.99, 30, 'Furniture')
        ];
        
        await productCollection.insertMany(initialProducts.map(product => product.toJSON()));
        console.log("Initial products seeded to MongoDB");
    } 
    
    catch (error) 
    {
        console.error("Error seeding initial data:", error.message);
    }
}

connectToMongoDB();

app.get('/api/products', async (req, res) => 
{
    try 
    {
        const { category, minPrice, maxPrice, minStock, page = 1, limit = 20 } = req.query;
        const filter = {};

        if (category) filter.category = category;
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = parseFloat(minPrice);
            if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
        }
        
        if (minStock) filter.stock = { $gte: parseInt(minStock) };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const products = await productCollection
            .find(filter)
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();

        const total = await productCollection.countDocuments(filter);

        res.json({
            products,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } 
    
    catch (error) 
    {
        console.error("Error fetching products:", error.message);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

app.get('/api/products/:id', async (req, res) => 
{
    try 
    {
        if (!ObjectId.isValid(req.params.id)) 
        {
            return res.status(400).json({ error: 'Invalid product ID format' });
        }

        const product = await productCollection.findOne({ 
            _id: new ObjectId(req.params.id) 
        });
        
        if (product) 
        {
            res.json(product);
        } 
        
        else 
        {
            res.status(404).json({ error: 'Product not found' });
        }
    } 
    
    catch (error) 
    {
        console.error("Error fetching product:", error.message);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

app.get('/api/products/name/:name', async (req, res) => 
{
    try 
    {
        const product = await productCollection.findOne({ 
            name: req.params.name 
        });
        
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    } 
    
    catch (error) 
    {
        console.error("Error fetching product:", error.message);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

app.post('/api/products', async (req, res) => 
{
    try 
    {
        const { name, price, stock, category } = req.body;
        
        const product = new Product(name, parseFloat(price), parseInt(stock), category);
        const validationErrors = product.validate();
        
        if (validationErrors.length > 0) 
        {
            return res.status(400).json({ errors: validationErrors });
        }

        const existingProduct = await productCollection.findOne({ name: product.name });
        if (existingProduct) 
        {
            return res.status(400).json({ error: 'Product with this name already exists' });
        }

        const result = await productCollection.insertOne(product.toJSON());
        
        res.status(201).json({
            ...product.toJSON(),
            _id: result.insertedId
        });
    } 
    
    catch (error) 
    {
        console.error("Error creating product:", error.message);
        if (error.code === 11000) {
            res.status(400).json({ error: 'Duplicate product name' });
        } else {
            res.status(500).json({ error: 'Failed to create product' });
        }
    }
});

app.put('/api/products/:id', async (req, res) => 
{
    try 
    {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid product ID format' });
        }

        const productId = new ObjectId(req.params.id);
        const { name, price, stock, category } = req.body;
        
        const existingProduct = await productCollection.findOne({ _id: productId });
        if (!existingProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (name && name !== existingProduct.name) 
        {
            const nameExists = await productCollection.findOne({ 
                name: name, 
                _id: { $ne: productId } 
            });
            
            if (nameExists) 
            {
                return res.status(400).json({ error: 'Product name already in use by another product' });
            }
        }

        if (price && (typeof price !== 'number' || price <= 0)) 
        {
            return res.status(400).json({ error: 'Price must be a positive number' });
        }
        
        if (stock !== undefined && (typeof stock !== 'number' || stock < 0)) 
        {
            return res.status(400).json({ error: 'Stock must be a non-negative number' });
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (price !== undefined) updateData.price = price;
        if (stock !== undefined) updateData.stock = stock;
        if (category) updateData.category = category;
        updateData.updatedAt = new Date();

        const result = await productCollection.updateOne(
            { _id: productId },
            { $set: updateData }
        );

        if (result.modifiedCount > 0 || result.matchedCount > 0) 
        {
            const updatedProduct = await productCollection.findOne({ _id: productId });
            res.json(updatedProduct);
        } else {
            res.status(400).json({ error: 'No changes made' });
        }
    } 
    
    catch (error) 
    {
        console.error("Error updating product:", error.message);
        if (error.code === 11000) {
            res.status(400).json({ error: 'Product name already exists' });
        } else {
            res.status(500).json({ error: 'Failed to update product' });
        }
    }
});

app.patch('/api/products/:id/stock', async (req, res) => 
{
    try 
    {
        if (!ObjectId.isValid(req.params.id)) 
        {
            return res.status(400).json({ error: 'Invalid product ID format' });
        }

        const productId = new ObjectId(req.params.id);
        const { quantity } = req.body;

        if (quantity === undefined || typeof quantity !== 'number' || quantity < 0) 
        {
            return res.status(400).json({ error: 'Valid quantity is required' });
        }

        const result = await productCollection.updateOne(
            { _id: productId },
            { 
                $set: { 
                    stock: quantity,
                    updatedAt: new Date()
                } 
            }
        );

        if (result.matchedCount === 0) 
        {
            return res.status(404).json({ error: 'Product not found' });
        }

        const updatedProduct = await productCollection.findOne({ _id: productId });
        res.json(updatedProduct);
    } 
    
    catch (error) 
    {
        console.error("Error updating product stock:", error.message);
        res.status(500).json({ error: 'Failed to update product stock' });
    }
});

app.delete('/api/products/:id', async (req, res) => 
{
    try 
    {
        if (!ObjectId.isValid(req.params.id)) 
        {
            return res.status(400).json({ error: 'Invalid product ID format' });
        }

        const productId = new ObjectId(req.params.id);
        
        const existingProduct = await productCollection.findOne({ _id: productId });
        if (!existingProduct) 
        {
            return res.status(404).json({ error: 'Product not found' });
        }

        const result = await productCollection.deleteOne({ _id: productId });

        if (result.deletedCount > 0) 
        {
            res.json({ 
                message: 'Product deleted successfully',
                deletedProduct: existingProduct 
            });
        } 
        
        else 
        {
            res.status(500).json({ error: 'Failed to delete product' });
        }
    } 
    
    catch (error) 
    {
        console.error("Error deleting product:", error.message);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

app.get('/api/products/stock/low', async (req, res) => 
{
    try 
    {
        const { threshold = 10 } = req.query;
        
        const products = await productCollection
            .find({ stock: { $lt: parseInt(threshold) } })
            .toArray();

        res.json({
            threshold: parseInt(threshold),
            count: products.length,
            products
        });
    } 
    
    catch (error) 
    {
        console.error("Error fetching low stock products:", error.message);
        res.status(500).json({ error: 'Failed to fetch low stock products' });
    }
});

process.on('SIGINT', async () => 
{
    await client.close();
    console.log('MongoDB connection closed');
    process.exit(0);
});

app.listen(3000, () => console.log('Server: http://localhost:3000'));