/* global require, process */
require('dotenv').config()

const express = require('express')
const cors = require('cors')

const userRoutes = require('./routes/userRoutes');
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");

const app = express();

app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

app.use("/api/chats", chatRoutes);
app.use('/api/users', userRoutes);
app.use("/api/messages", messageRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'NexChat API is running' })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, '0.0.0.0', () => {
    console.log(`NexChat API running on port ${PORT}`)
})