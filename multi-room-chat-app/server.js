const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Message = require('./models/message');
const User = require('./models/User');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Create necessary directories
const uploadsDir = path.join(__dirname, 'public', 'uploads');
const logsDir = path.join(__dirname, 'logs');

[uploadsDir, logsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Function to log chat messages
function logChat(messageData) {
  const logPath = path.join(logsDir, 'chat_log.txt');
  const timestamp = new Date().toISOString();
  let logMessage = '';

  switch(messageData.type) {
    case 'text':
      logMessage = `[${timestamp}] [${messageData.room}] ${messageData.username}: ${messageData.message}\n`;
      break;
    case 'image':
      logMessage = `[${timestamp}] [${messageData.room}] ${messageData.username} sent an image: ${messageData.fileUrl}\n`;
      break;
    case 'voice':
      logMessage = `[${timestamp}] [${messageData.room}] ${messageData.username} sent a voice message: ${messageData.fileUrl}\n`;
      break;
    default:
      logMessage = `[${timestamp}] [${messageData.room}] ${messageData.username}: ${JSON.stringify(messageData)}\n`;
  }

  fs.appendFile(logPath, logMessage, (err) => {
    if (err) {
      console.error('Error writing to chat log:', err);
    }
  });
}

mongoose.connect('mongodb://localhost/chatdb', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log('MongoDB connection error:', err));

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Basic middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Profile photo upload endpoint
app.post('/upload/profile', upload.single('file'), async (req, res) => {
  try {
    // Log the incoming request
    console.log('Profile upload request received:', {
      body: req.body,
      file: req.file ? {
        filename: req.file.filename,
        mimetype: req.file.mimetype
      } : 'No file'
    });

    if (!req.file) {
      console.error('No file received in profile upload');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const username = req.body.username;
    if (!username || username.trim() === '') {
      console.error('Invalid username in profile upload:', username);
      return res.status(400).json({ error: 'Valid username is required' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    console.log('Processing profile upload:', {
      username,
      fileUrl,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype
    });

    // Update user profile in database
    const user = await User.findOneAndUpdate(
      { username: username.trim() },
      { 
        username: username.trim(),
        profilePhoto: fileUrl
      },
      { upsert: true, new: true }
    );

    // Update profiles cache
    userProfiles[username] = fileUrl;

    console.log('Profile photo updated successfully:', {
      username,
      fileUrl,
      userId: user._id
    });

    res.json({ 
      fileUrl,
      success: true,
      message: 'Profile photo updated successfully'
    });
  } catch (error) {
    console.error('Profile upload error:', error);
    res.status(500).json({ 
      error: 'Failed to update profile photo',
      details: error.message 
    });
  }
});

// File upload endpoint for messages
app.post('/upload/message', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    console.log('File uploaded:', {
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      url: fileUrl
    });

    res.json({ fileUrl });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

let usernames = {};
let rooms = [
  { name: "global", creator: "Anonymous" },
  { name: "chess", creator: "Anonymous" },
];

// Keep track of user profiles
let userProfiles = {};

io.on("connection", function (socket) {
  console.log(`User connected to server.`);

  // Handle request for user profiles
  socket.on("getUserProfiles", async function() {
    try {
      const users = await User.find({}, 'username profilePhoto');
      const profiles = {};
      users.forEach(user => {
        profiles[user.username] = user.profilePhoto;
      });
      socket.emit("userProfiles", profiles);
    } catch (error) {
      console.error('Error fetching user profiles:', error);
    }
  });

  socket.on("createUser", async function (username) {
    socket.username = username;
    usernames[username] = username;
    socket.currentRoom = "global";
    socket.join("global");

    // Create or update user in database
    try {
      const user = await User.findOneAndUpdate(
        { username },
        { username },
        { upsert: true, new: true }
      );
      
      // Store user's profile photo
      userProfiles[username] = user.profilePhoto;
      
      console.log(`User ${username} created/updated in database`);
    } catch (error) {
      console.error('Error updating user in database:', error);
    }

    socket.emit("updateChat", "INFO", "You have joined global room");
    socket.broadcast.to("global").emit("updateChat", "INFO", `${username} has joined global room`);
    io.sockets.emit("updateUsers", usernames);
    socket.emit("updateRooms", rooms, "global");
    
    // Send current user profiles to the new user
    socket.emit("userProfiles", userProfiles);
  });

  socket.on("sendMessage", async function (data) {
    console.log(`Message received from ${socket.username}:`, data);
    
    const messageData = {
      room: socket.currentRoom || 'global',
      username: socket.username,
      message: data.message,
      type: data.type || 'text',
      fileUrl: data.fileUrl,
      timestamp: new Date()
    };

    try {
      // Save to MongoDB
      const message = new Message(messageData);
      await message.save();
      console.log('Message saved to database');

      // Log to file
      logChat(messageData);

      // Send to all clients in the room
      io.to(messageData.room).emit("updateChat", socket.username, data);
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  // Handle profile updates
  socket.on('profileUpdate', async function(data) {
    try {
      const user = await User.findOneAndUpdate(
        { username: data.username },
        { profilePhoto: data.profileUrl },
        { new: true }
      );
      
      // Update local cache
      userProfiles[data.username] = data.profileUrl;
      
      // Notify all users about profile update
      io.sockets.emit('userProfileUpdated', {
        username: data.username,
        profileUrl: data.profileUrl
      });
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  });

  socket.on("createRoom", function (room) {
    if (room != null && !rooms.find(r => r.name === room)) {
      rooms.push({ name: room, creator: socket.username });
      io.sockets.emit("updateRooms", rooms, null);
    }
  });

  socket.on('updateRooms', async (room) => {
    socket.broadcast
      .to(socket.currentRoom)
      .emit("updateChat", "INFO", `${socket.username} left room`);
    socket.leave(socket.currentRoom);
    socket.currentRoom = room;
    socket.join(room);
    socket.emit("updateChat", "INFO", `You have joined ${room} room`);
    socket.broadcast
      .to(room)
      .emit("updateChat", "INFO", `${socket.username} has joined ${room} room`);

    try {
      const messages = await Message.find({ room }).sort({ timestamp: 1 }).limit(50);
      messages.forEach(msg => {
        socket.emit('updateChat', msg.username, {
          message: msg.message,
          type: msg.messageType,
          fileUrl: msg.fileUrl
        });
      });
    } catch (err) {
      console.error("Error fetching chat history:", err);
    }
  });

  socket.on("disconnect", function () {
    console.log(`User ${socket.username} disconnected from server.`);
    delete usernames[socket.username];
    io.sockets.emit("updateUsers", usernames);
    socket.broadcast.emit("updateChat", "INFO", `${socket.username} has disconnected`);
  });
});

server.listen(5000, '0.0.0.0', function () {
  console.log("Listening on http://<your-pc-ip>:5000");
});
