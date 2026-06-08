/* MQTT over WebSocket bridge for the browser dashboard. */
const MQTT_BROKER_URL = 'ws://localhost:9001';
const MQTT_CLIENT_ID = 'dashboard-' + Math.random().toString(16).slice(2, 10);

const MQTT_TOPIC_DATA = 'solar/node01/data';
const MQTT_TOPIC_ALERT = 'solar/node01/alert';
const MQTT_TOPIC_STATUS = 'solar/node01/status';
const MQTT_TOPIC_CMD = 'solar/node01/cmd';

let mqttClient = null;
let mqttConnected = false;

function setMqttStatus(text, cls) {
  const el = document.getElementById('hdr-status');
  if (!el) return;
  el.textContent = text;
  el.className = 'status-badge ' + (cls || 'warn');
}

function connectMqtt(onData, onAlert, onStatus, onFallback) {
  if (typeof mqtt === 'undefined') {
    console.warn('[MQTT] mqtt.js is not loaded');
    onFallback && onFallback();
    return;
  }

  mqttClient = mqtt.connect(MQTT_BROKER_URL, {
    clientId: MQTT_CLIENT_ID,
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 5000,
  });

  mqttClient.on('connect', () => {
    mqttConnected = true;
    console.log('[MQTT] Connected:', MQTT_BROKER_URL);
    mqttClient.subscribe([MQTT_TOPIC_DATA, MQTT_TOPIC_ALERT, MQTT_TOPIC_STATUS]);
    setMqttStatus('MQTT CONNECTED', 'ok');
  });

  mqttClient.on('reconnect', () => setMqttStatus('MQTT RECONNECT', 'warn'));

  mqttClient.on('offline', () => {
    mqttConnected = false;
    setMqttStatus('MQTT OFFLINE', 'warn');
  });

  mqttClient.on('error', err => {
    console.warn('[MQTT] Error:', err && err.message ? err.message : err);
    setMqttStatus('MQTT ERROR', 'crit');
  });

  mqttClient.on('message', (topic, payload) => {
    let data;
    try {
      data = JSON.parse(payload.toString());
    } catch (err) {
      console.warn('[MQTT] JSON parse error:', payload.toString());
      return;
    }

    if (topic === MQTT_TOPIC_DATA) onData && onData(data);
    if (topic === MQTT_TOPIC_ALERT) onAlert && onAlert(data);
    if (topic === MQTT_TOPIC_STATUS) onStatus && onStatus(data);
  });

  setTimeout(() => {
    if (!mqttConnected) {
      console.warn('[MQTT] WebSocket not connected, falling back to simulation');
      onFallback && onFallback();
    }
  }, 6000);
}

function mqttSendCmd(payload) {
  if (!mqttClient || !mqttConnected) {
    console.warn('[MQTT] Not connected, command dropped:', payload);
    return false;
  }
  mqttClient.publish(MQTT_TOPIC_CMD, JSON.stringify(payload));
  return true;
}

function mqttSetLoad(state) {
  return mqttSendCmd({ load: state });
}

function mqttSetAuto(state) {
  return mqttSendCmd({ auto: state });
}

function mqttSetThresholds(tempOff, tempOn) {
  return mqttSendCmd({ tempOff, tempOn });
}
