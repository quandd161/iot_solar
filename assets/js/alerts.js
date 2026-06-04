/* =============================================================
   alerts.js — Alert log matching firmware MQTT alert payload
   ============================================================= */

const ALERT_DEFS = {
  'SENSOR_ERROR': { label:'Lỗi cảm biến DS18B20', msg:'Không đọc được nhiệt độ — tải bị ngắt tự động', type:'critical' },
  'OVER_TEMP':    { label:'Nhiệt độ quá cao',     msg:'Nhiệt độ vượt ngưỡng tempOff — tải bị ngắt',   type:'critical' },
  'LOAD_ON':      { label:'Tải đã BẬT',           msg:'Lệnh bật tải được thực thi',                    type:'info'     },
  'LOAD_OFF':     { label:'Tải đã TẮT',           msg:'Lệnh tắt tải được thực thi',                    type:'info'     },
  'TEMP_WARN':    { label:'Cảnh báo nhiệt độ',    msg:'Nhiệt độ gần ngưỡng tempOff — theo dõi sát',    type:'warning'  },
  'WIFI_LOST':    { label:'Mất kết nối WiFi',     msg:'Thiết bị offline',                              type:'warning'  },
  'MQTT_LOST':    { label:'Mất kết nối MQTT',     msg:'Broker không phản hồi',                         type:'warning'  },
};

const Alerts = (() => {
  const log      = [];
  const cooldown = {};
  const MAX_LOG  = 20;
  let unread     = 0;

  function push(code, extraMsg) {
    const def = ALERT_DEFS[code];
    if (!def) return;

    const now = Date.now();
    if (code !== 'LOAD_ON' && code !== 'LOAD_OFF') {
      if (cooldown[code] && now - cooldown[code] < ALERT_COOLDOWN) return;
    }
    cooldown[code] = now;

    const t = new Date();
    log.unshift({
      id:    now,
      time:  t.toLocaleTimeString('vi-VN'),
      date:  t.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' }),
      code,
      ...def,
      msg: extraMsg || def.msg,
    });
    if (log.length > MAX_LOG) log.pop();

    unread++;
    _updateBadges();
    _render();
  }

  function check(data) {
    if (data.status === 'SENSOR_ERROR') {
      push('SENSOR_ERROR');
    } else if (data.status === 'OVER_TEMP') {
      push('OVER_TEMP', `Nhiệt độ ${data.temp}°C ≥ ngưỡng ${data.tempOff}°C`);
    } else if (data.temp >= data.tempOff - 3 && data.temp < data.tempOff) {
      push('TEMP_WARN', `Nhiệt độ ${data.temp}°C gần ngưỡng ${data.tempOff}°C`);
    }
  }

  function _updateBadges() {
    document.querySelectorAll('.alert-badge').forEach(el => {
      el.textContent = unread > 9 ? '9+' : unread;
      el.classList.toggle('hidden', unread === 0);
    });
  }

  function _render() {
    const containers = document.querySelectorAll('.alert-list-target');
    containers.forEach(el => {
      if (!log.length) {
        el.innerHTML = '<div class="alert-empty">Chưa có cảnh báo nào</div>';
        return;
      }
      el.innerHTML = log.map(a => `
        <div class="alert-item ${a.type}">
          <div class="alert-dot ${a.type}"></div>
          <div class="alert-content">
            <div class="alert-row1">
              <span class="alert-label">${a.label}</span>
              <span class="alert-time">${a.date} ${a.time}</span>
            </div>
            <div class="alert-msg">${a.msg}</div>
          </div>
        </div>
      `).join('');
    });
  }

  function clearUnread() {
    unread = 0;
    _updateBadges();
  }

  function getLog() { return log; }

  return { push, check, clearUnread, getLog, render: _render };
})();
