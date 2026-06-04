/* =============================================================
   sim.js — Simulation engine matching embedded firmware output
   ============================================================= */

const SIM_INTERVAL   = 5000;
const ALERT_COOLDOWN = 30000;

/* Shared simulation state — mirrors firmware publishMqttData() payload */
const sim = {
  dev:        'solar_node01',
  ts:         0,

  temp:       42.5,       // DS18B20 °C (-100 = sensor error)
  voltage:    12.4,       // INA219 bus voltage V
  current_mA: 350.0,      // INA219 current mA
  power_mW:   4340.0,     // INA219 power mW

  load:       true,       // MOSFET load state
  auto:       true,       // auto mode

  tempOff:    35.0,       // threshold to turn load off
  tempOn:     30.0,       // threshold to turn load back on

  status:     'NORMAL',   // NORMAL | OVER_TEMP | SENSOR_ERROR

  sampleN:    0,
};

/* Mean-reverting random walk */
function rw(cur, target, noise, lo, hi) {
  const pull   = (target - cur) * 0.06;
  const jitter = (Math.random() - 0.5) * 2 * noise;
  return Math.min(hi, Math.max(lo, cur + pull + jitter));
}

function simulateStep() {
  sim.ts = Math.floor(Date.now() / 1000);
  sim.sampleN++;

  /* Simulate temperature */
  const tempTarget = sim.load ? 38 : 28;
  sim.temp       = rw(sim.temp, tempTarget, 0.6, 20, 60);
  sim.temp       = parseFloat(sim.temp.toFixed(1));

  /* Simulate INA219 readings */
  sim.voltage    = rw(sim.voltage,    12.4, 0.15, 10.5, 14.5);
  sim.current_mA = rw(sim.current_mA, sim.load ? 380 : 20, 15, 0, 1000);
  sim.power_mW   = parseFloat((sim.voltage * sim.current_mA).toFixed(1));

  sim.voltage    = parseFloat(sim.voltage.toFixed(2));
  sim.current_mA = parseFloat(sim.current_mA.toFixed(1));

  /* Clamp small negatives (matches firmware noise filter) */
  if (sim.current_mA < 0 && sim.current_mA > -1.0) sim.current_mA = 0;
  if (sim.power_mW   < 0 && sim.power_mW   > -5.0) sim.power_mW   = 0;

  /* Derive status — mirrors updateLoadByTemperature() logic */
  sim.sensorError = false;
  sim.overTemp    = false;

  if (sim.temp < -100) {
    sim.sensorError = true;
    sim.status = 'SENSOR_ERROR';
    if (sim.auto) sim.load = false;
  } else if (sim.auto) {
    if (sim.temp >= sim.tempOff) {
      sim.overTemp = true;
      sim.status = 'OVER_TEMP';
      sim.load = false;
    } else if (sim.temp <= sim.tempOn) {
      sim.status = 'NORMAL';
      sim.load = true;
    } else {
      /* hysteresis band — keep current state */
      sim.status = sim.load ? 'NORMAL' : 'OVER_TEMP';
    }
  } else {
    sim.status = sim.temp >= sim.tempOff ? 'OVER_TEMP' : 'NORMAL';
  }

  Alerts.check(sim);
}

function startSimulation(onTick) {
  const tick = () => { simulateStep(); onTick(sim); };
  tick();
  setInterval(tick, SIM_INTERVAL);
}
