// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD6AVt4SPQeicno-1HV8Ny8-6UfQAc0mnY",
  authDomain: "greenhouse-46794.firebaseapp.com",
  databaseURL: "https://greenhouse-46794-default-rtdb.firebaseio.com",
  projectId: "greenhouse-46794",
  storageBucket: "greenhouse-46794.firebasestorage.app",
  messagingSenderId: "654406931247",
  appId: "1:654406931247:web:1681ef09807bf660fec7da",
  measurementId: "G-1ZZ0R6156M"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Elements
const elements = {
  temp: document.getElementById('nhietdo'),
  humi: document.getElementById('doam'),
  co2: document.getElementById('khico2'),
  denImg: document.getElementById('imgDen'),
  quatImg: document.getElementById('imgQuat'),
  mayphunImg: document.getElementById('imgMayPhun'),
  logList: document.getElementById('log-list'),
  time: document.getElementById('time'),
  menuToggle: document.getElementById('menu-toggle'),
  sidebar: document.getElementById('sidebar'),
  main: document.getElementById('main'),
  dynamicContent: document.getElementById('dynamicContent'),
  bieudoContent: document.getElementById('bieudo-content')
};

const buttons = {
  denOn: document.getElementById('btnDenOn'),
  denOff: document.getElementById('btnDenOff'),
  quatOn: document.getElementById('btnQuatOn'),
  quatOff: document.getElementById('btnQuatOff'),
  mayphunOn: document.getElementById('btnMayPhunOn'),
  mayphunOff: document.getElementById('btnMayPhunOff')
};

// Variables
let chartInstance = null;
let currentRoom = 'vuon1';
let logs = {};
let sensorData = {};

// Check Firebase connection
database.ref('.info/connected').on('value', snap => {
  if (snap.val() === true) {
    console.log('Đã kết nối với Firebase');
  } else {
    console.log('Mất kết nối với Firebase');
  }
});

// Add log entry
function addLogEntry(message) {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  const logMessage = `[${timeStr}] ${message} - Vườn: ${currentRoom}`;

  const logRef = database.ref(`${currentRoom}/logs`).push();
  logRef.set({ message: logMessage })
    .catch(error => console.error(`Lỗi thêm nhật ký cho ${currentRoom}:`, error));
}

// Load logs
function loadLogs() {
  const rooms = ['vuon1', 'vuon2', 'vuon3', 'vuon4'];
  rooms.forEach(room => {
    database.ref(`${room}/logs`).on('child_added', snap => {
      const log = snap.val();
      if (!logs[room]) logs[room] = [];
      logs[room].unshift(log.message);
      if (logs[room].length > 10) {
        logs[room].pop();
      }
      if (currentRoom === room && elements.main.style.display !== 'none') {
        displayLogs();
      }
    }, error => console.error(`Lỗi đọc nhật ký cho ${room}:`, error));
  });
}

// Display logs
function displayLogs() {
  elements.logList.innerHTML = '';
  const roomLogs = logs[currentRoom] || [];
  roomLogs.forEach(log => {
    const li = document.createElement('li');
    li.textContent = log;
    elements.logList.prepend(li);
  });
  while (elements.logList.children.length > 10) {
    elements.logList.removeChild(elements.logList.lastChild);
  }
}

// Initialize sensor data and logs
function initializeData() {
  const rooms = ['vuon1', 'vuon2', 'vuon3', 'vuon4'];
  rooms.forEach(room => {
    sensorData[room] = {
      temp: [],
      humi: [],
      co2: [],
      timestamps: []
    };

    database.ref(room).on('value', snap => {
      try {
        const data = snap.val() || { 
          temp: 0, 
          humi: 0, 
          co2: 0, 
          den: 0, 
          quat: 0, 
          tuoi: 0, 
          totalTime: { den: 0, quat: 0, tuoi: 0 }, 
          status: { connection: 0 } 
        };
        const now = new Date();
        const timeStr = now.toLocaleTimeString();

        sensorData[room].timestamps.push(timeStr);
        sensorData[room].temp.push(data.temp || 0);
        sensorData[room].humi.push(data.humi || 0);
        sensorData[room].co2.push(data.co2 || 0);

        if (sensorData[room].timestamps.length > 10) {
          sensorData[room].timestamps.shift();
          sensorData[room].temp.shift();
          sensorData[room].humi.shift();
          sensorData[room].co2.shift();
        }

        if (currentRoom === room) {
          updateDisplay(data);
          updateDeviceStates(data);
          if (elements.bieudoContent.style.display === 'block') {
            renderChart();
          }
        }
      } catch (error) {
        console.error(`Lỗi xử lý dữ liệu cho ${room}:`, error);
      }
    }, error => console.error(`Lỗi lắng nghe ${room}:`, error));

    database.ref(room).once('value', snap => {
      if (!snap.exists()) {
        const defaultData = {
          temp: 0,
          humi: 0,
          co2: 0,
          den: 0,
          quat: 0,
          tuoi: 0,
          status: { connection: 0 },
          totalTime: { den: 0, quat: 0, tuoi: 0 }
        };
        database.ref(room).set(defaultData)
          .then(() => console.log(`Khởi tạo dữ liệu mặc định cho ${room}`))
          .catch(error => console.error(`Lỗi khởi tạo ${room}:`, error));
      } else {
        const data = snap.val();
        if (data.den === undefined) database.ref(room + '/den').set(0);
        if (data.quat === undefined) database.ref(room + '/quat').set(0);
        if (data.tuoi === undefined) database.ref(room + '/tuoi').set(0);
        if (data.status === undefined || data.status.connection === undefined) {
          database.ref(room + '/status/connection').set(0);
        }
        if (data.totalTime === undefined) {
          database.ref(room + '/totalTime').set({ den: 0, quat: 0, tuoi: 0 });
        }
      }
    }, error => console.error(`Lỗi kiểm tra sự tồn tại của ${room}:`, error));
  });
}

// Update display
function updateDisplay(data) {
  elements.temp.innerText = `${isNaN(data.temp) ? 0 : data.temp.toFixed(1)} °C`;
  elements.humi.innerText = `${isNaN(data.humi) ? 0 : data.humi.toFixed(1)} %`;
  elements.co2.innerText = `${isNaN(data.co2) ? 0 : data.co2.toFixed(0)} ppm`;
}

// Update device states
function updateDeviceStates(data) {
  elements.denImg.src = data.den ? 'image/densang.gif' : 'image/dentat.png';
  elements.quatImg.src = data.quat ? 'image/quatbat.gif' : 'image/quattat.png';
  elements.mayphunImg.src = data.tuoi ? 'image/mayphunbat.gif' : 'image/mayphuntat.png';
}

// Toggle device
function toggleDevice(device, state) {
  console.log(`Cập nhật ${currentRoom}/${device} thành ${state}`);
  const ref = database.ref(currentRoom).child(device);
  ref.set(state).then(() => {
    console.log(`Thành công: ${currentRoom}/${device} = ${state}`);
    if (device === 'den') {
      elements.denImg.src = state ? 'image/densang.gif' : 'image/dentat.png';
      addLogEntry(`Đèn được ${state ? 'bật' : 'tắt'}`);
    } else if (device === 'quat') {
      elements.quatImg.src = state ? 'image/quatbat.gif' : 'image/quattat.png';
      addLogEntry(`Quạt được ${state ? 'bật' : 'tắt'}`);
    } else if (device === 'tuoi') {
      elements.mayphunImg.src = state ? 'image/mayphunbat.gif' : 'image/mayphuntat.png';
      addLogEntry(`Máy Phun được ${state ? 'bật' : 'tắt'}`);
    }
  }).catch(error => {
    console.error(`Lỗi điều khiển ${device} cho ${currentRoom}:`, error);
  });
}

// Event listeners
function setupEventListeners() {
  if (elements.menuToggle) {
    elements.menuToggle.addEventListener('click', () => {
      console.log('Menu toggle clicked');
      elements.sidebar.classList.toggle('open');
    });
  } else {
    console.error('Menu toggle element not found');
  }
  buttons.denOn.addEventListener('click', () => toggleDevice('den', 1));
  buttons.denOff.addEventListener('click', () => toggleDevice('den', 0));
  buttons.quatOn.addEventListener('click', () => toggleDevice('quat', 1));
  buttons.quatOff.addEventListener('click', () => toggleDevice('quat', 0));
  buttons.mayphunOn.addEventListener('click', () => toggleDevice('tuoi', 1));
  buttons.mayphunOff.addEventListener('click', () => toggleDevice('tuoi', 0));
}

// Select room
function selectRoom(room) {
  if (!['vuon1', 'vuon2', 'vuon3', 'vuon4'].includes(room)) {
    console.error(`Vườn không hợp lệ: ${room}`);
    return;
  }
  currentRoom = room;
  console.log(`Chuyển sang vườn: ${currentRoom}`);

  const backgroundImages = {
    vuon1: 'url("image/vuon1.jpeg")', 
    vuon2: 'url("image/vuon2.jpeg")', 
    vuon3: 'url("image/vuon3.jpeg")', 
    vuon4: 'url("image/vuon4.jpeg")'
  };
  document.body.style.backgroundImage = backgroundImages[room] || 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)';

  database.ref(currentRoom).once('value', snap => {
    const data = snap.val() || { 
      temp: 0, 
      humi: 0, 
      co2: 0, 
      den: 0, 
      quat: 0, 
      tuoi: 0, 
      totalTime: { den: 0, quat: 0, tuoi: 0 }, 
      status: { connection: 0 } 
    };
    console.log(`Dữ liệu cho ${currentRoom}:`, data);
    updateDisplay(data);
    updateDeviceStates(data);
    displayLogs();
    if (elements.bieudoContent.style.display === 'block') {
      renderChart();
    }
  }, error => console.error(`Lỗi lấy dữ liệu cho ${currentRoom}:`, error));
}

// Show section
function showSection(section) {
  if (section === 'home') {
    elements.main.style.display = 'block';
    elements.dynamicContent.style.display = 'none';
    displayLogs();
  } else if (section === 'bieudo') {
    elements.main.style.display = 'none';
    elements.dynamicContent.style.display = 'block';
    elements.bieudoContent.style.display = 'block';
    renderChart();
  }
  elements.sidebar.classList.remove('open');
}

// Charts
const ctx = document.getElementById('humidityChart').getContext('2d');
function renderChart() {
  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sensorData[currentRoom].timestamps,
      datasets: [
        {
          label: 'Nhiệt độ (°C)',
          data: sensorData[currentRoom].temp,
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
          barThickness: 20,
        },
        {
          label: 'Độ ẩm (%)',
          data: sensorData[currentRoom].humi,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
          barThickness: 20,
        },
        {
          label: 'Khí C02 (ppm)',
          data: sensorData[currentRoom].co2,
          backgroundColor: 'rgba(255, 165, 0, 0.6)',
          borderColor: 'rgba(255, 165, 0, 1)',
          borderWidth: 1,
          barThickness: 20,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Giá trị' },
          ticks: {
            stepSize: 100
          }
        },
        x: {
          title: { display: true, text: 'Thời gian' }
        }
      },
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: `Dữ liệu ${currentRoom}` }
      }
    }
  });
}

// Clock
function updateClock() {
  const now = new Date();
  let hours = now.getHours().toString().padStart(2, '0');
  let minutes = now.getMinutes().toString().padStart(2, '0');
  let seconds = now.getSeconds().toString().padStart(2, '0');
  let timeString = `${hours}:${minutes}:${seconds}`;
  elements.time.textContent = timeString;
}

// Initialize
window.onload = () => {
  initializeData();
  loadLogs();
  setupEventListeners();
  setInterval(updateClock, 1000);
  updateClock();
};