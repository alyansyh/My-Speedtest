// ============================================================
//  ESP32 Firmware — WiFi Stats + Servo
//  Konfigurasi IP server bisa diubah via Serial Monitor
//  tanpa perlu upload ulang firmware
// ============================================================

#include <WiFi.h>
#include <ESP32Servo.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WebServer.h>
#include <Preferences.h>   // ← simpan IP server ke flash

// ─── Konfigurasi WiFi ─────────────────────────────────────
const char* ssid     = "PONDOK SINJAI.01A";
const char* password = "Mubarak88";

// ─── IP Server Default (Next.js) ──────────────────────────
// Jika IP berubah, kirim perintah via Serial Monitor:
//   SET_SERVER=192.168.1.XX:3000
// Perubahan tersimpan di flash, tidak hilang saat restart.
#define DEFAULT_SERVER_IP   "192.168.1.80"
#define DEFAULT_SERVER_PORT "3000"

// ─── Pin Servo ────────────────────────────────────────────
#define SERVO_PIN 15

// ─── Timing ───────────────────────────────────────────────
#define SEND_INTERVAL_MS 2000

// ─────────────────────────────────────────────────────────
Servo       servoH;
WebServer   server(80);
Preferences prefs;

int    currentAngleH = 90;
String serverUrl;          // diisi saat setup()
unsigned long lastSendTime = 0;

// ─── Baca/simpan URL server ke flash ──────────────────────
String buildServerUrl(String ipPort) {
  return "http://" + ipPort + "/api/wifi-stats";
}

void loadServerUrl() {
  prefs.begin("cfg", true);  // read-only
  String saved = prefs.getString("serverIP", "");
  prefs.end();

  if (saved.length() == 0) {
    saved = String(DEFAULT_SERVER_IP) + ":" + DEFAULT_SERVER_PORT;
  }
  serverUrl = buildServerUrl(saved);
  Serial.println("[CFG] Server URL: " + serverUrl);
}

void saveServerUrl(String ipPort) {
  prefs.begin("cfg", false);
  prefs.putString("serverIP", ipPort);
  prefs.end();
  serverUrl = buildServerUrl(ipPort);
  Serial.println("[CFG] Server URL disimpan: " + serverUrl);
}

// ─── Konversi RSSI ────────────────────────────────────────
int rssiToSignal(int rssi) {
  return constrain(map(rssi, -90, -30, 0, 100), 0, 100);
}

float rssiToReceiveRate(int rssi) {
  if (rssi >= -50) return 300.0;
  if (rssi >= -60) return 150.0;
  if (rssi >= -70) return  54.0;
  if (rssi >= -80) return  11.0;
  if (rssi >= -90) return   5.5;
  return 1.0;
}

// ─── Kirim data WiFi ke server ────────────────────────────
void sendWifiStats() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WARN] WiFi putus, skip POST");
    return;
  }

  int   rssi   = WiFi.RSSI();
  int   signal = rssiToSignal(rssi);
  float rxRate = rssiToReceiveRate(rssi);
  float txRate = rxRate * 0.85f;

  StaticJsonDocument<256> doc;
  doc["angleH"]       = currentAngleH;
  doc["rssi"]         = rssi;
  doc["signal"]       = signal;
  doc["receiveRate"]  = rxRate;
  doc["transmitRate"] = txRate;

  // Tambahan info WiFi jika tersedia
  doc["ssid"]    = WiFi.SSID();
  doc["bssid"]   = WiFi.BSSIDstr();
  doc["channel"] = WiFi.channel();

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");

  // Kirim IP ESP32 lewat header agar server bisa deteksi dengan benar
  // (berguna jika ESP32 berada di balik NAT atau proxy)
  http.addHeader("X-ESP32-IP", WiFi.localIP().toString());

  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    Serial.printf("[POST] %d | RSSI: %d dBm | Signal: %d%% | RX: %.1f Mbps | TX: %.1f Mbps\n",
                  httpCode, rssi, signal, rxRate, txRate);
  } else {
    Serial.printf("[POST ERROR] %s → %s\n",
                  serverUrl.c_str(), http.errorToString(httpCode).c_str());
    Serial.println("[TIP] Jika IP server berubah, ketik di Serial: SET_SERVER=<ip>:<port>");
  }

  http.end();
}

// ─── Handler servo via HTTP ───────────────────────────────
void handleSetServo() {
  // CORS header agar bisa dipanggil dari browser
  server.sendHeader("Access-Control-Allow-Origin", "*");

  if (!server.hasArg("angle")) {
    server.send(400, "text/plain", "Missing angle");
    return;
  }

  int angle = constrain(server.arg("angle").toInt(), 0, 180);
  servoH.write(angle);
  currentAngleH = angle;

  Serial.printf("[SERVO] → %d°\n", angle);
  server.send(200, "application/json",
    "{\"ok\":true,\"angle\":" + String(angle) + "}");
}

// ─── Cek perintah dari Serial Monitor ────────────────────
//  Format: SET_SERVER=192.168.1.XX:3000
//          SHOW_IP          → tampilkan IP saat ini
void handleSerial() {
  if (!Serial.available()) return;

  String cmd = Serial.readStringUntil('\n');
  cmd.trim();

  if (cmd.startsWith("SET_SERVER=")) {
    String ipPort = cmd.substring(11);
    ipPort.trim();
    if (ipPort.length() > 0) {
      saveServerUrl(ipPort);
    } else {
      Serial.println("[ERR] Format salah. Contoh: SET_SERVER=192.168.1.80:3000");
    }
  } else if (cmd == "SHOW_IP") {
    Serial.println("[INFO] ESP32 IP  : " + WiFi.localIP().toString());
    Serial.println("[INFO] Server URL: " + serverUrl);
  } else if (cmd.length() > 0) {
    Serial.println("[HELP] Perintah tersedia:");
    Serial.println("  SET_SERVER=<ip>:<port>  — ubah IP server Next.js");
    Serial.println("  SHOW_IP                 — tampilkan IP saat ini");
  }
}

// ─── Setup ────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);

  // Baca URL server dari flash (atau pakai default)
  loadServerUrl();

  // Servo
  servoH.attach(SERVO_PIN);
  servoH.write(currentAngleH);
  Serial.printf("[SERVO] Init → %d°\n", currentAngleH);

  // WiFi
  WiFi.begin(ssid, password);
  Serial.print("[WiFi] Connecting");
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - t0 > 15000) {
      Serial.println("\n[WiFi] Timeout! Restart...");
      ESP.restart();
    }
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("[WiFi] Connected!");
  Serial.println("[WiFi] IP        : " + WiFi.localIP().toString());
  Serial.println("[WiFi] SSID      : " + WiFi.SSID());
  Serial.printf( "[WiFi] RSSI      : %d dBm | Signal: %d%%\n",
                 WiFi.RSSI(), rssiToSignal(WiFi.RSSI()));
  Serial.println("[WiFi] Server URL: " + serverUrl);
  Serial.println();
  Serial.println("─── Serial Commands ───────────────────────────");
  Serial.println("  SET_SERVER=<ip>:<port>  ubah IP server Next.js");
  Serial.println("  SHOW_IP                 lihat IP saat ini");
  Serial.println("───────────────────────────────────────────────");

  // Web server lokal (terima perintah servo dari Next.js)
  server.on("/setServo", handleSetServo);
  server.begin();
  Serial.println("[Server] WebServer started on port 80");
}

// ─── Loop ─────────────────────────────────────────────────
void loop() {
  server.handleClient();
  handleSerial();

  if (millis() - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = millis();
    sendWifiStats();
  }
}
