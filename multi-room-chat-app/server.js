const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Message = require('./models/Message');
const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/chatdb', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log('MongoDB connection error:', err));

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let usernames = {};
let rooms = [
  { name: "global", creator: "Anonymous" },
  { name: "chess", creator: "Anonymous" },
];

io.on("connection", function (socket) {
  console.log(`User connected to server.`);

  socket.on("createUser", function (username) {
    socket.username = username;
    usernames[username] = username;
    socket.currentRoom = "global";
    socket.join("global");

    console.log(`User ${username} created on server successfully.`);

    socket.emit("updateChat", "INFO", "You have joined global room");
    socket.broadcast.to("global").emit("updateChat", "INFO", `${username} has joined global room`);
    io.sockets.emit("updateUsers", usernames);
    socket.emit("updateRooms", rooms, "global");
  });

  // ✅ This was incorrectly nested — it's now at the correct place
  socket.on('sendMessage', async (msg) => {
    console.log(`Message received from ${socket.username}: ${msg}`);
    const messageData = {
      room: socket.currentRoom || 'global',
      username: socket.username,
      message: msg
    };

    const message = new Message(messageData);
    await message.save();

    io.to(messageData.room).emit('updateChat', messageData.username, messageData.message);
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
        socket.emit('updateChat', msg.username, msg.message);
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
