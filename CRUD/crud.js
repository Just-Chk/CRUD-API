const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const app = express();
app.use(express.json());

const config = require('./config');
const uri = config.mongodbUri;       

const client = new MongoClient(uri);

const dbName = "day-15";
const collectionName = "crud-api";

let db, usersCollection;

async function seedInitialData() 
{
    try 
    {
        const initialUsers = 
        [
            { name: 'Rahul', email: 'rahul@example.com', age: 25, role: 'user', createdAt: new Date() },
            { name: 'Aditi', email: 'aditi@example.com', age: 24, role: 'admin', createdAt: new Date() },
            { name: 'Priya', email: 'priya@example.com', age: 26, role: 'user', createdAt: new Date() },
            { name: 'Amit', email: 'amit@example.com', age: 28, role: 'admin', createdAt: new Date() },
            { name: 'Neha', email: 'neha@example.com', age: 23, role: 'user', createdAt: new Date() }
        ];
        
        await usersCollection.insertMany(initialUsers);
        console.log("Initial users seeded to MongoDB");
    } 
    
    catch (error) 
    {
        console.error("Error seeding initial data:", error.message);
    }
}

async function connectToMongoDB() 
{
    try 
    {
        await client.connect();
        console.log("Connected to MongoDB Atlas");
        db = client.db(dbName);
        usersCollection = db.collection(collectionName);
        
        await usersCollection.createIndex({ email: 1 }, { unique: true });
        
        await usersCollection.createIndex({ role: 1 });
        
        const count = await usersCollection.countDocuments();
        if (count === 0) {
            await seedInitialData();
        }
    } 
    
    catch (error) 
    {
        console.error("MongoDB connection error:", error.message);
        process.exit(1);
    }
}

connectToMongoDB();

app.get('/users', async (req, res) => 
{
    try 
    {
        const users = await usersCollection.find().toArray();
        res.json(users);
    } 
    
    catch (error) 
    {
        console.error("Error fetching users:", error.message);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.get('/users/:id', async (req, res) => 
{
    try 
    {
        if (!ObjectId.isValid(req.params.id)) 
        {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }
        
        const user = await usersCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (user) 
        {
            res.json(user);
        } 
        
        else 
        {
            res.status(404).json({ error: 'User not found' });
        }
    } 
    
    catch (error) 
    {
        console.error("Error fetching user:", error.message);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

app.get('/admins', async (req, res) => 
{
    try 
    {
        const admins = await usersCollection.find({ role: 'admin' }).toArray();
        
        if (admins.length > 0) 
        {
            res.json(admins);
        } 
        
        else 
        {
            res.status(404).json({ message: 'No admin users found' });
        }
    } 
    
    catch (error) 
    {
        console.error("Error fetching admin users:", error.message);
        res.status(500).json({ error: 'Failed to fetch admin users' });
    }
});

app.get('/users/average-age', async (req, res) => 
{
    try 
    {
        const pipeline = [
            {
                $group: {
                    _id: null,
                    averageAge: { $avg: "$age" },
                    totalUsers: { $sum: 1 },
                    minAge: { $min: "$age" },
                    maxAge: { $max: "$age" }
                }
            },
            {
                $project: {
                    _id: 0,
                    averageAge: { $round: ["$averageAge", 2] },
                    totalUsers: 1,
                    minAge: 1,
                    maxAge: 1
                }
            }
        ];
        
        const result = await usersCollection.aggregate(pipeline).toArray();
        
        if (result.length > 0) 
        {
            res.json({
                averageAge: result[0].averageAge,
                totalUsers: result[0].totalUsers,
                minAge: result[0].minAge,
                maxAge: result[0].maxAge
            });
        } 
        
        else 
        {
            res.json({ 
                averageAge: 0, 
                totalUsers: 0,
                message: 'No users found' 
            });
        }
    } 
    
    catch (error) 
    {
        console.error("Error calculating average age:", error.message);
        res.status(500).json({ error: 'Failed to calculate average age' });
    }
});

app.get('/users/average-age/:role', async (req, res) => 
{
    try 
    {
        const role = req.params.role;
        
        if (!['admin', 'user'].includes(role)) 
        {
            return res.status(400).json({ error: 'Role must be either "admin" or "user"' });
        }
        
        const pipeline = [
            {
                $match: { role: role }
            },
            {
                $group: {
                    _id: "$role",
                    averageAge: { $avg: "$age" },
                    totalUsers: { $sum: 1 },
                    minAge: { $min: "$age" },
                    maxAge: { $max: "$age" }
                }
            },
            {
                $project: {
                    _id: 0,
                    role: "$_id",
                    averageAge: { $round: ["$averageAge", 2] },
                    totalUsers: 1,
                    minAge: 1,
                    maxAge: 1
                }
            }
        ];
        
        const result = await usersCollection.aggregate(pipeline).toArray();
        
        if (result.length > 0) 
        {
            res.json(result[0]);
        } 
        
        else 
        {
            res.status(404).json({ 
                message: `No users found with role: ${role}` 
            });
        }
    } 
    
    catch (error) 
    {
        console.error("Error calculating average age by role:", error.message);
        res.status(500).json({ error: 'Failed to calculate average age by role' });
    }
});

app.post('/users', async (req, res) => 
{
    try 
    {
        const { name, email, age, role } = req.body;
        
        if (!name || !email || !age) {
            return res.status(400).json({ error: 'Name, email and age are required' });
        }
        
        const existingUser = await usersCollection.findOne({ email: email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        
        const newUser = 
        {
            name,
            email,
            age: parseInt(age),
            role: role || 'user',
            createdAt: new Date()
        };
        
        if (role && !['admin', 'user'].includes(role)) {
            return res.status(400).json({ error: 'Role must be either "admin" or "user"' });
        }
        
        const result = await usersCollection.insertOne(newUser);
        res.status(201).json({ ...newUser, _id: result.insertedId });
    } 
    
    catch (error) 
    {
        console.error("Error creating user:", error.message);
        
        if (error.code === 11000) 
        {
            res.status(400).json({ error: 'Email already exists' });
        } 
        
        else 
        {
            res.status(500).json({ error: 'Failed to create user' });
        }
    }
});

app.put('/users/:id', async (req, res) => 
{
    try 
    {
        const userId = req.params.id;
        
        if (!ObjectId.isValid(userId)) 
        {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }
        
        const existingUser = await usersCollection.findOne({ _id: new ObjectId(userId) });
        if (!existingUser) 
        {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const { name, email, age, role } = req.body;
        
        // Validate role if provided
        if (role && !['admin', 'user'].includes(role)) {
            return res.status(400).json({ error: 'Role must be either "admin" or "user"' });
        }
        
        if (email && email !== existingUser.email) 
        {
            const emailExists = await usersCollection.findOne({ 
                email: email, 
                _id: { $ne: new ObjectId(userId) } 
            });
            
            if (emailExists) {
                return res.status(400).json({ error: 'Email already in use by another user' });
            }
        }
        
        const updateData = { ...req.body };
        
        if (updateData.age) {
            updateData.age = parseInt(updateData.age);
        }
        
        updateData.updatedAt = new Date();
        
        const result = await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: updateData }
        );
        
        if (result.modifiedCount > 0 || result.matchedCount > 0) 
        {
            const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) });
            res.json(updatedUser);
        } 
        
        else 
        {
            res.status(400).json({ error: 'No changes made' });
        }
    } 
    
    catch (error) 
    {
        console.error("Error updating user:", error.message);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

app.delete('/users/:id', async (req, res) => 
{
    try 
    {
        const userId = req.params.id;
        
        if (!ObjectId.isValid(userId)) 
        {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }
        
        const existingUser = await usersCollection.findOne({ _id: new ObjectId(userId) });
        if (!existingUser) 
        {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) });
        
        if (result.deletedCount > 0) 
        {
            res.json({ message: 'User deleted successfully' });
        } 
        
        else 
        {
            res.status(500).json({ error: 'Failed to delete user' });
        }
    } 
    
    catch (error) 
    {
        console.error("Error deleting user:", error.message);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

process.on('SIGINT', async () => 
{
    await client.close();
    console.log('MongoDB connection closed');
    process.exit(0);
});

app.listen(3000, () => console.log('Server: http://localhost:3000'));