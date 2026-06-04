# Hướng dẫn cài đặt & chạy dự án Smart Solar MQTT

## Tổng quan kiến trúc

```
┌─────────────────────┐        MQTT        ┌──────────────────────┐
│   ESP32 (firmware)  │ ─────────────────► │   MQTT Broker        │
│                     │ ◄───────────────── │   (Mosquitto)        │
│  - DS18B20 (nhiệt)  │                    └──────────────────────┘
│  - INA219 (đo điện) │                              │
│  - OLED SSD1306     │                              │ Subscribe
│  - MOSFET load      │                              ▼
└─────────────────────┘                    ┌──────────────────────┐
                                           │  Dashboard (HTML)    │
                                           │  dashboard.html      │
                                           │  (chạy trên browser) │
                                           └──────────────────────┘
```

---

## Phần 1 — Cài đặt MQTT Broker (Mosquitto)

Dashboard cần một MQTT broker làm trung gian. Cách đơn giản nhất là cài **Mosquitto** trên máy tính của bạn.

### 1.1 Cài Mosquitto trên Windows

1. Tải installer tại: https://mosquitto.org/download/
2. Chạy file `.exe` → Next → Next → Install
3. Sau khi cài, mở **Services** (Win + R → `services.msc`) → tìm `Mosquitto Broker` → Start

### 1.2 Cấu hình Mosquitto cho phép kết nối ngoài

Mặc định Mosquitto chỉ chấp nhận kết nối từ localhost. Cần mở thêm:

Tìm file cấu hình tại: `C:\Program Files\mosquitto\mosquitto.conf`

Mở bằng Notepad (chạy với quyền Administrator), thêm vào cuối file:

```
listener 1883
allow_anonymous true
```

Sau đó restart Mosquitto:
- Mở PowerShell với quyền Administrator
- Chạy: `net stop mosquitto` rồi `net start mosquitto`

### 1.3 Kiểm tra Mosquitto hoạt động

Mở 2 cửa sổ PowerShell:

**Cửa sổ 1 — Subscribe (lắng nghe):**
```powershell
& "C:\Program Files\mosquitto\mosquitto_sub.exe" -h localhost -t "solar/node01/#" -v
```

**Cửa sổ 2 — Publish (gửi test):**
```powershell
& "C:\Program Files\mosquitto\mosquitto_pub.exe" -h localhost -t "solar/node01/data" -m "{\"temp\":35.5}"
```

Nếu cửa sổ 1 in ra `solar/node01/data {"temp":35.5}` thì broker đang hoạt động tốt.

---

## Phần 2 — Cài đặt firmware cho ESP32

### 2.1 Phần cứng cần chuẩn bị

| Linh kiện | Số lượng | Ghi chú |
|---|---|---|
| ESP32 Dev Module | 1 | Bất kỳ board ESP32 nào |
| Cảm biến DS18B20 | 1 | Cảm biến nhiệt độ 1-Wire |
| Điện trở 4.7kΩ | 1 | Pull-up cho DS18B20 |
| Module INA219 | 1 | Đo dòng/áp/công suất |
| OLED SSD1306 128×64 | 1 | Giao tiếp I²C |
| MOSFET (N-channel) | 1 | Điều khiển tải |
| Dây nối, nguồn | — | — |

### 2.2 Sơ đồ kết nối phần cứng

```
ESP32               DS18B20
─────               ───────
3.3V ─────────────── VCC
GND  ─────────────── GND
GPIO_DS ──┬────────── DATA
          │
         4.7kΩ
          │
3.3V ─────┘
(GPIO_DS = pin DATA của DS18B20, thường GPIO 4)

ESP32               INA219
─────               ──────
3.3V ─────────────── VCC
GND  ─────────────── GND
GPIO21 (SDA) ─────── SDA
GPIO22 (SCL) ─────── SCL

ESP32               SSD1306 OLED
─────               ────────────
3.3V ─────────────── VCC
GND  ─────────────── GND
GPIO21 (SDA) ─────── SDA
GPIO22 (SCL) ─────── SCL

ESP32               MOSFET (tải)
─────               ────────────
MOSFET_PIN ────────── GATE
GND ────────────────── SOURCE
                DRAIN ── Tải âm (-)
```

> **Lưu ý:** INA219 và SSD1306 cùng dùng I²C (GPIO21/22). Địa chỉ mặc định: INA219 = 0x40, SSD1306 = 0x3C.

### 2.3 Cài Arduino IDE và các thư viện

**Bước 1 — Cài Arduino IDE 2.x:**
Tải tại: https://www.arduino.cc/en/software

**Bước 2 — Thêm board ESP32:**
- Mở Arduino IDE → File → Preferences
- Paste vào "Additional boards manager URLs":
  ```
  https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
  ```
- Vào Tools → Board → Boards Manager → tìm "esp32" → Install `esp32 by Espressif Systems`

**Bước 3 — Cài thư viện (Tools → Manage Libraries):**

| Tên thư viện | Version tối thiểu | Tác giả |
|---|---|---|
| Adafruit INA219 | 1.2.3 | Adafruit |
| DallasTemperature | 3.9.1 | Miles Burton |
| OneWire | 2.3.7 | Jim Studt |
| Adafruit SSD1306 | 2.5.7 | Adafruit |
| Adafruit GFX Library | — | Adafruit (dependency của SSD1306) |
| PubSubClient | 2.8.0 | Nick O'Leary |
| ArduinoJson | 6.21.3 | Benoit Blanchon |

### 2.4 Chỉnh sửa firmware trước khi nạp

Mở file `.ino` của firmware, tìm và sửa các hằng số cấu hình:

```cpp
// ── WiFi ──────────────────────────────────────
#define WIFI_SSID     "TEN_WIFI_CUA_BAN"
#define WIFI_PASSWORD "MAT_KHAU_WIFI"

// ── MQTT ──────────────────────────────────────
// IP máy tính đang chạy Mosquitto
// Tìm IP bằng cách: mở cmd → gõ ipconfig → xem IPv4
#define MQTT_BROKER   "192.168.1.XXX"
#define MQTT_PORT     1883
#define MQTT_CLIENT_ID "solar_node01"

// ── Topics ────────────────────────────────────
#define MQTT_TOPIC_DATA   "solar/node01/data"
#define MQTT_TOPIC_ALERT  "solar/node01/alert"
#define MQTT_TOPIC_STATUS "solar/node01/status"
#define MQTT_TOPIC_CMD    "solar/node01/cmd"

// ── Pins ──────────────────────────────────────
#define MOSFET_PIN    26      // Điều chỉnh theo sơ đồ của bạn
#define ONE_WIRE_BUS  4       // Pin DATA của DS18B20
#define OLED_ADDRESS  0x3C

// ── Ngưỡng nhiệt độ mặc định ──────────────────
float tempOffLimit = 35.0;   // Tắt tải khi temp >= 35°C
float tempOnLimit  = 30.0;   // Bật lại khi temp <= 30°C

// ── Thời gian gửi MQTT ─────────────────────────
#define MQTT_SEND_MS  5000   // Gửi mỗi 5 giây
```

### 2.5 Nạp firmware lên ESP32

1. Cắm ESP32 vào máy tính qua cáp USB
2. Chọn board: Tools → Board → esp32 → **ESP32 Dev Module**
3. Chọn port: Tools → Port → chọn COMx (xem Device Manager nếu không biết)
4. Nhấn nút Upload (mũi tên →)
5. Mở Serial Monitor (Tools → Serial Monitor, baud 115200) để theo dõi log

Log bình thường sẽ giống:
```
[WiFi] Connecting to TEN_WIFI...
[WiFi] Connected. IP: 192.168.1.105
[MQTT] Connecting to 192.168.1.100
[MQTT] Connected
[MQTT] Subscribed: solar/node01/cmd
Temp: 32.5 C | V: 12.40 V | I: 350.0 mA | P: 4340.0 mW | Load: ON | Mode: AUTO
[MQTT] Publish data: {"dev":"solar_node01","ts":1234,"temp":32.5,...}
```

---

## Phần 3 — Chạy Dashboard (Giao diện web)

### 3.1 Vấn đề quan trọng: MQTT qua WebSocket

Browser không thể kết nối trực tiếp MQTT TCP. Cần dùng **MQTT over WebSocket**.

**Bước 1 — Bật WebSocket trong Mosquitto:**

Mở `C:\Program Files\mosquitto\mosquitto.conf`, sửa thành:

```
# MQTT TCP (cho ESP32)
listener 1883
allow_anonymous true

# MQTT WebSocket (cho browser/dashboard)
listener 9001
protocol websockets
allow_anonymous true
```

Restart Mosquitto sau khi sửa.

**Bước 2 — Thêm thư viện MQTT.js vào dashboard:**

Mở [dashboard.html](dashboard.html), trong thẻ `<head>` thêm:
```html
<script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>
```

**Bước 3 — Tạo file `assets/js/mqtt-client.js`** với nội dung:

```javascript
/* =============================================================
   mqtt-client.js — Kết nối MQTT WebSocket thật với broker
   ============================================================= */

const BROKER_URL = 'ws://192.168.1.XXX:9001';  // Sửa IP máy tính của bạn
const CLIENT_ID  = 'dashboard-' + Math.random().toString(16).substr(2, 8);

const TOPIC_DATA   = 'solar/node01/data';
const TOPIC_ALERT  = 'solar/node01/alert';
const TOPIC_STATUS = 'solar/node01/status';
const TOPIC_CMD    = 'solar/node01/cmd';

let mqttClient = null;
let mqttConnected = false;

function connectMqtt(onData, onAlert, onStatus) {
  mqttClient = mqtt.connect(BROKER_URL, {
    clientId: CLIENT_ID,
    clean: true,
    reconnectPeriod: 5000,
  });

  mqttClient.on('connect', () => {
    mqttConnected = true;
    console.log('[MQTT] Connected');

    mqttClient.subscribe(TOPIC_DATA);
    mqttClient.subscribe(TOPIC_ALERT);
    mqttClient.subscribe(TOPIC_STATUS);

    /* Cập nhật UI online badge */
    const badge = document.querySelector('.online-badge');
    if (badge) badge.style.background = '#10b98115';
  });

  mqttClient.on('disconnect', () => {
    mqttConnected = false;
    console.log('[MQTT] Disconnected');
  });

  mqttClient.on('message', (topic, payload) => {
    try {
      const data = JSON.parse(payload.toString());
      if (topic === TOPIC_DATA)   onData(data);
      if (topic === TOPIC_ALERT)  onAlert(data);
      if (topic === TOPIC_STATUS) onStatus(data);
    } catch(e) {
      console.error('[MQTT] JSON parse error', e);
    }
  });
}

/* Gửi lệnh điều khiển tới ESP32 */
function mqttSendCmd(payload) {
  if (!mqttClient || !mqttConnected) {
    console.warn('[MQTT] Not connected, command dropped');
    return;
  }
  mqttClient.publish(TOPIC_CMD, JSON.stringify(payload));
  console.log('[MQTT] Sent cmd:', payload);
}

/* Wrapper functions dùng trong app.js */
function mqttSetLoad(state)    { mqttSendCmd({ load: state }); }
function mqttSetAuto(state)    { mqttSendCmd({ auto: state }); }
function mqttSetTempOff(val)   { mqttSendCmd({ tempOff: val }); }
function mqttSetTempOn(val)    { mqttSendCmd({ tempOn: val }); }
```

**Bước 4 — Tích hợp vào app.js** (khi đã sẵn sàng dùng MQTT thật):

Trong [assets/js/app.js](assets/js/app.js), thay `startSimulation(updateUI)` thành:

```javascript
// Dùng MQTT thật thay vì simulation:
connectMqtt(
  (data) => updateUI(data),     // nhận data mỗi 5 giây
  (alert) => {                   // nhận alert từ firmware
    if (alert.type) Alerts.push(alert.type, alert.message);
  },
  (status) => {                  // nhận online/offline
    const badge = document.querySelector('.online-badge');
    if (badge) badge.style.opacity = status.online ? '1' : '0.4';
  }
);
```

Và trong `toggleLoad()`, `toggleAuto()`, `applyThresholds()` thêm lệnh gửi MQTT thật:
```javascript
function toggleLoad() {
  const newState = !sim.load;
  mqttSetAuto(false);   // chuyển sang manual
  mqttSetLoad(newState); // gửi lệnh tới ESP32
  // ... phần còn lại giữ nguyên
}
```

### 3.2 Mở Dashboard (chế độ Simulation — không cần ESP32)

Hiện tại dashboard đã có sẵn engine mô phỏng (`sim.js`). Chỉ cần:

1. Mở thư mục `nhung_iot_btl` trong File Explorer
2. Double-click vào `dashboard.html`
3. Dashboard tự chạy, dữ liệu được mô phỏng mỗi 5 giây

> Không cần server, không cần cài Node.js, mở thẳng bằng browser là được.

### 3.3 Mở Dashboard qua Live Server (khuyến nghị cho dev)

Nếu dùng VS Code:

1. Cài extension **Live Server** (Ritwick Dey)
2. Click chuột phải vào `dashboard.html` → **Open with Live Server**
3. Browser tự mở tại `http://127.0.0.1:5500/dashboard.html`

---

## Phần 4 — Kiểm tra luồng dữ liệu đầu cuối

### 4.1 Checklist trước khi chạy thật

- [ ] Mosquitto đang chạy (kiểm tra Services)
- [ ] Port 1883 (TCP) và 9001 (WebSocket) đã được bật trong `mosquitto.conf`
- [ ] ESP32 đã kết nối WiFi thành công (xem Serial Monitor)
- [ ] ESP32 đã kết nối MQTT broker thành công (xem Serial Monitor)
- [ ] IP của broker trong firmware khớp với IP máy tính
- [ ] Dashboard đã load `mqtt.min.js` và `mqtt-client.js`

### 4.2 Test từng bước

**Test 1 — Xem ESP32 đang publish gì:**
```powershell
& "C:\Program Files\mosquitto\mosquitto_sub.exe" -h localhost -t "solar/node01/#" -v
```
Phải thấy JSON in ra mỗi 5 giây.

**Test 2 — Gửi lệnh bật/tắt tải:**
```powershell
# Tắt tải thủ công
& "C:\Program Files\mosquitto\mosquitto_pub.exe" -h localhost -t "solar/node01/cmd" -m "{\"load\":false}"

# Bật lại tự động
& "C:\Program Files\mosquitto\mosquitto_pub.exe" -h localhost -t "solar/node01/cmd" -m "{\"auto\":true}"

# Đổi ngưỡng nhiệt
& "C:\Program Files\mosquitto\mosquitto_pub.exe" -h localhost -t "solar/node01/cmd" -m "{\"tempOff\":40}"
& "C:\Program Files\mosquitto\mosquitto_pub.exe" -h localhost -t "solar/node01/cmd" -m "{\"tempOn\":35}"
```

**Test 3 — Kiểm tra WebSocket từ browser:**

Mở browser Console (F12), paste:
```javascript
const c = mqtt.connect('ws://localhost:9001');
c.on('connect', () => { c.subscribe('solar/node01/#'); console.log('OK'); });
c.on('message', (t, p) => console.log(t, p.toString()));
```

---

## Phần 5 — Cấu trúc MQTT payload

### 5.1 Data topic: `solar/node01/data` (ESP32 → Dashboard, mỗi 5s)

```json
{
  "dev": "solar_node01",
  "ts": 1234567,
  "temp": 32.5,
  "voltage": 12.40,
  "current_mA": 350.0,
  "power_mW": 4340.0,
  "load": true,
  "auto": true,
  "tempOff": 35.0,
  "tempOn": 30.0,
  "status": "NORMAL"
}
```

| Field | Kiểu | Mô tả |
|---|---|---|
| `temp` | float | Nhiệt độ DS18B20 (°C). Giá trị < -100 = lỗi cảm biến |
| `voltage` | float | Điện áp bus INA219 (V) |
| `current_mA` | float | Dòng điện INA219 (mA) |
| `power_mW` | float | Công suất INA219 (mW) |
| `load` | bool | Trạng thái MOSFET: true = tải đang bật |
| `auto` | bool | true = tự động theo nhiệt độ, false = thủ công |
| `tempOff` | float | Ngưỡng nhiệt độ tắt tải |
| `tempOn` | float | Ngưỡng nhiệt độ bật lại tải |
| `status` | string | `NORMAL` / `OVER_TEMP` / `SENSOR_ERROR` |

### 5.2 Alert topic: `solar/node01/alert` (ESP32 → Dashboard, khi có sự kiện)

```json
{
  "dev": "solar_node01",
  "ts": 1234567,
  "temp": 36.2,
  "load": false,
  "type": "OVER_TEMP",
  "message": "Temperature too high, load off"
}
```

### 5.3 Status topic: `solar/node01/status` (Will message)

```json
{ "online": true }   // khi kết nối
{ "online": false }  // will message khi mất kết nối
```

### 5.4 Command topic: `solar/node01/cmd` (Dashboard → ESP32)

```json
{ "auto": true }      // chuyển sang chế độ tự động
{ "auto": false }     // chuyển sang chế độ thủ công
{ "load": true }      // bật tải (tự động chuyển sang manual)
{ "load": false }     // tắt tải (tự động chuyển sang manual)
{ "tempOff": 40.0 }   // đổi ngưỡng tắt
{ "tempOn": 35.0 }    // đổi ngưỡng bật
```

> **Lưu ý:** Khi gửi `{"load":...}`, firmware tự động chuyển sang manual mode. Để trở về auto: gửi `{"auto":true}`.
>
> **Ràng buộc:** `tempOn` phải nhỏ hơn `tempOff` ít nhất 1°C. Firmware tự sửa nếu vi phạm: `tempOn = tempOff - 2.0`.

---

## Phần 6 — Logic điều khiển tự động (updateLoadByTemperature)

```
if (autoMode == false)        → không làm gì (manual mode)
if (temp < -100)              → sensorError=true, tắt tải
if (temp >= tempOff)          → overTemp=true, tắt tải
if (temp <= tempOn)           → bật lại tải
if (tempOn < temp < tempOff)  → giữ nguyên trạng thái (hysteresis)
```

Ví dụ với `tempOff=35`, `tempOn=30`:
- Nhiệt độ tăng từ 28°C lên 35°C → tải tắt
- Nhiệt độ còn 32°C (trong band 30–35) → tải vẫn tắt (giữ nguyên)
- Nhiệt độ giảm xuống 30°C → tải bật lại

---

## Phần 7 — Troubleshooting

| Vấn đề | Nguyên nhân | Giải pháp |
|---|---|---|
| ESP32 không kết nối WiFi | Sai SSID/password | Kiểm tra Serial Monitor |
| ESP32 không kết nối MQTT | Sai IP broker hoặc broker chưa chạy | Ping IP broker từ máy khác cùng mạng |
| Dashboard không nhận dữ liệu | WebSocket chưa bật trong mosquitto.conf | Thêm `listener 9001 / protocol websockets` |
| `temp` hiện `ERR` | DS18B20 bị lỗi hoặc không kết nối | Kiểm tra dây, điện trở pull-up 4.7kΩ |
| Nút điều khiển không có tác dụng | Dashboard dùng simulation, chưa gửi MQTT thật | Tích hợp `mqtt-client.js` như Phần 3 |
| Dòng điện hiện giá trị âm | Bình thường (nhiễu nhỏ) | Firmware đã filter: < -1mA → 0 |
| OLED hiện "INA219 ERROR" | INA219 không nhận I²C | Kiểm tra dây SDA/SCL và địa chỉ 0x40 |

---

## Phần 8 — Cấu trúc file dự án

```
nhung_iot_btl/
├── dashboard.html          ← Mở file này trên browser để xem dashboard
├── SETUP_GUIDE.md          ← File hướng dẫn này
└── assets/
    ├── css/
    │   └── main.css        ← Toàn bộ style (dark theme)
    └── js/
        ├── alerts.js       ← Quản lý nhật ký cảnh báo
        ├── gauge.js        ← Đồng hồ đo canvas (voltage/current/power)
        ├── charts.js       ← Biểu đồ Chart.js (power/voltage/current/temp)
        ├── sim.js          ← Engine mô phỏng dữ liệu (không cần ESP32)
        └── app.js          ← Tab router, cập nhật UI, xử lý lệnh điều khiển
```

> File firmware `.ino` nằm ngoài thư mục này — cần upload riêng lên ESP32 qua Arduino IDE.
