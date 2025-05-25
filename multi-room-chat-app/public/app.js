var socket = io();

var userlist = document.getElementById("active_users_list");
var roomlist = document.getElementById("active_rooms_list");
var message = document.getElementById("messageInput");
var sendMessageBtn = document.getElementById("send_message_btn");
var roomInput = document.getElementById("roomInput");
var createRoomBtn = document.getElementById("room_add_icon_holder");
var chatDisplay = document.getElementById("chat");
var imageUpload = document.getElementById("image-upload");
var voiceRecordBtn = document.getElementById("voice-record-btn");
var profileUpload = document.getElementById("profile-upload");
var profileImg = document.getElementById("profile-img");
var profileUsername = document.getElementById("profile-username");

var currentRoom = "global";
var myUsername = "";
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

// Keep track of user profiles
let userProfiles = {};

socket.on("connect", function () {
  myUsername = prompt("Enter name: ");
  if (myUsername) {
    socket.emit("createUser", myUsername);
    profileUsername.textContent = myUsername;
    console.log("Username set to:", myUsername);
  }
  
  // Get all user profiles
  socket.emit("getUserProfiles");
});

// Handle receiving user profiles
socket.on("userProfiles", function(profiles) {
  userProfiles = profiles;
  updateUserList(usernames); // Update user list to show new profile photos
});

// Handle single user profile update
socket.on("userProfileUpdated", function(data) {
  userProfiles[data.username] = data.profileUrl;
  updateUserList(usernames);
});

// Handle chat updates
socket.on("updateChat", function (username, data) {
  if (username === "INFO") {
    chatDisplay.innerHTML += `<div class="announcement"><span>${data}</span></div>`;
  } else {
    let messageContent = '';
    
    if (data.type === 'image') {
      messageContent = `
        <div class="image-container">
          <img src="${data.fileUrl}" alt="Image" style="max-width: 200px; height: auto;" />
        </div>
      `;
    } else if (data.type === 'voice') {
      messageContent = `
        <div class="voice-container">
          <audio controls>
            <source src="${data.fileUrl}" type="audio/wav">
            Your browser does not support the audio element.
          </audio>
        </div>
      `;
    } else {
      messageContent = `<span class="message_text">${data.message}</span>`;
    }

    const userPhotoUrl = userProfiles[username] || '/uploads/default-profile.png';
    
    chatDisplay.innerHTML += `
      <div class="message_holder ${username === myUsername ? "me" : ""}">
        <div class="pic">
          <img src="${userPhotoUrl}" alt="${username}'s profile" class="user-photo"/>
        </div>
        <div class="message_box">
          <div class="message ${data.type}-message">
            <span class="message_name">${username}</span>
            ${messageContent}
          </div>
        </div>
      </div>`;
  }

  chatDisplay.scrollTop = chatDisplay.scrollHeight;
});

// Handle image uploads
imageUpload.addEventListener("change", async function(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/upload/message', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    const data = await response.json();
    console.log('Upload response:', data);

    socket.emit("sendMessage", {
      type: 'image',
      fileUrl: data.fileUrl
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    alert('Failed to upload image. Please try again.');
  }
});

// Handle voice recording
voiceRecordBtn.addEventListener("click", async function() {
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.addEventListener("dataavailable", event => {
        audioChunks.push(event.data);
      });

      mediaRecorder.addEventListener("stop", async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('file', audioBlob, 'voice-message.wav');

        try {
          const response = await fetch('/upload/message', {
            method: 'POST',
            body: formData
          });
          const data = await response.json();
          
          socket.emit("sendMessage", {
            type: 'voice',
            fileUrl: data.fileUrl
          });
        } catch (error) {
          console.error('Error uploading voice message:', error);
          alert('Failed to upload voice message. Please try again.');
        }
      });

      mediaRecorder.start();
      isRecording = true;
      voiceRecordBtn.innerHTML = '<i class="fas fa-microphone recording-indicator"></i>';
    } catch (error) {
      console.error('Error starting voice recording:', error);
      alert('Failed to start recording. Please check your microphone permissions.');
    }
  } else {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    isRecording = false;
    voiceRecordBtn.innerHTML = '<i class="fas fa-microphone"></i>';
  }
});

// Send text message
sendMessageBtn.addEventListener("click", function () {
  if (message.value.trim()) {
    socket.emit("sendMessage", {
      type: 'text',
      message: message.value
    });
    message.value = "";
  }
});

// Send message on enter
message.addEventListener("keyup", function (event) {
  if (event.key === "Enter") {
    sendMessageBtn.click();
  }
});

// Create new room
createRoomBtn.addEventListener("click", function () {
  let roomName = roomInput.value.trim();
  if (roomName !== "") {
    socket.emit("createRoom", roomName);
    roomInput.value = "";
  }
});

// Update rooms
socket.on("updateRooms", function (rooms, newRoom) {
  roomlist.innerHTML = "";
  for (var index in rooms) {
    roomlist.innerHTML += `
      <div class="room_card" id="${rooms[index].name}" onclick="changeRoom('${rooms[index].name}')">
        <div class="room_item_content">
          <div class="pic"></div>
          <div class="roomInfo">
            <span class="room_name">#${rooms[index].name}</span>
            <span class="room_author">${rooms[index].creator}</span>
          </div>
        </div>
      </div>`;
  }
  document.getElementById(currentRoom).classList.add("active_item");
});

// Update users
socket.on("updateUsers", updateUserList);

// Change room
function changeRoom(room) {
  if (room != currentRoom) {
    socket.emit("updateRooms", room);
    document.getElementById(currentRoom).classList.remove("active_item");
    currentRoom = room;
    document.getElementById(currentRoom).classList.add("active_item");
  }
}

// Update the updateUsers function to show profile photos
function updateUserList(usernames) {
  userlist.innerHTML = "";
  for (var user in usernames) {
    const userPhotoUrl = userProfiles[user] || '/uploads/default-profile.png';
    userlist.innerHTML += `
      <div class="user_card">
        <div class="pic">
          <img src="${userPhotoUrl}" alt="${user}'s profile" class="user-photo"/>
        </div>
        <span>${user}</span>
      </div>`;
  }
}

// Handle profile photo upload
profileUpload.addEventListener("change", async function(e) {
  if (!myUsername) {
    console.log('Username not set');
    return;
  }

  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    console.log('Invalid file type selected');
    return;
  }

  // Show loading state
  profileImg.style.opacity = '0.5';
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('username', myUsername);

  try {
    console.log('Uploading profile photo for user:', myUsername);
    
    const response = await fetch('/upload/profile', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    console.log('Server response:', data);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to upload profile photo');
    }

    // Update profile image
    profileImg.src = data.fileUrl;
    userProfiles[myUsername] = data.fileUrl;
    
    // Update UI
    updateUserList(usernames);
    
    // Notify other users
    socket.emit('profileUpdate', {
      username: myUsername,
      profileUrl: data.fileUrl
    });

  } catch (error) {
    console.error('Error uploading profile photo:', error);
    // Reset profile image to previous state if there was an error
    if (userProfiles[myUsername]) {
      profileImg.src = userProfiles[myUsername];
    }
  } finally {
    // Reset loading state
    profileImg.style.opacity = '1';
  }
});
