const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let messages = [];

io.on('connection', (socket) => {
  console.log('a user connected');

  // Send last 10 messages to the user
  socket.emit('chat history', messages.slice(-10));

  // Listen for new messages
  socket.on('new message', (msg) => {
    const messageData = {
      user: msg.user,
      text: msg.text,
      timestamp: new Date(),
    };
    messages.push(messageData);
    io.emit('new message', messageData); // Broadcast to everyone
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});