// WiFi
#include <WiFi.h>
// WiFi Credentials
#define WIFI_SSID "HUY HOANG"
#define WIFI_PASSWORD "123456789"

// Firebase
#include <FirebaseESP32.h>
#define FIREBASE_HOST "https://greenhouse-46794-default-rtdb.firebaseio.com/"
#define FIREBASE_AUTH "yE66g4zyWlyHUS8X1DNHU8hwwihhGggab8McqSYC" 

// DHT11
#include <DHT.h>
#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// Cảm biến khí (MQ-2) mô phỏng CO2
#define GAS_SENSOR_PIN 36
#define CO2_THRESHOLD 2000 // Ngưỡng CO2 (ppm)

//  mô phỏng thiết bị
#define DEN_1 26   
#define QUAT_1 25    
#define TUOI_1 15 
#define DEN_2 14   
#define QUAT_2 27    
#define TUOI_2 33 
#define DEN_3 32   
#define QUAT_3 17    
#define TUOI_3 22 
#define DEN_4 21   
#define QUAT_4 19    
#define TUOI_4 5  

// Firebase Objects
FirebaseData fbdo;
FirebaseConfig firebaseConfig;
FirebaseAuth firebaseAuth;
FirebaseJson json; // Thêm FirebaseJson để xử lý dữ liệu JSON

// Thời gian xử lý không chặn
unsigned long previousMillis = 0;
const long interval = 2000; // Gửi dữ liệu mỗi 2 giây

// Danh sách vườn
const char* vuons[] = {"vuon1", "vuon2", "vuon3", "vuon4"};
const int numVuons = 4;

void setup() {
    Serial.begin(9600);
    Serial.println(F("Khởi động DHT11, MQ-2 và Firebase cho 4 phòng (1 bộ cảm biến,  mô phỏng thiết bị)!"));

    // Thiết lập chân 
    int Pins[] = {DEN_1, QUAT_1, TUOI_1, DEN_2, QUAT_2, TUOI_2,
                     DEN_3, QUAT_3, TUOI_3, DEN_4, QUAT_4, TUOI_4};
    for (int i = 0; i < 12; i++) {
        pinMode(Pins[i], OUTPUT);
        digitalWrite(Pins[i], LOW);
    }

    // Kết nối WiFi
    connectWiFi();

    // Khởi động DHT11
    dht.begin();

    // Khởi tạo MQ-2
    pinMode(GAS_SENSOR_PIN, INPUT);

    // Cấu hình Firebase
    firebaseConfig.host = FIREBASE_HOST;
    firebaseConfig.signer.tokens.legacy_token = FIREBASE_AUTH;
    Firebase.begin(&firebaseConfig, &firebaseAuth);
    Firebase.reconnectWiFi(true);

    if (Firebase.ready()) {
        Serial.println("Đã kết nối Firebase!");
        for (int i = 0; i < numVuons; i++) {
            Firebase.setInt(fbdo, String("/") + vuons[i] + "/status/connection", 1);
        }
    } else {
        Serial.println("Không thể kết nối Firebase!");
    }

    // Khởi tạo trạng thái
    initializeFirebaseStates();
}

void loop() {
    unsigned long currentMillis = millis();
    if (currentMillis - previousMillis >= interval) {
        previousMillis = currentMillis;

        // Kiểm tra WiFi
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("WiFi ngắt kết nối, thử lại...");
            connectWiFi();
            for (int i = 0; i < numVuons; i++) {
                Firebase.setInt(fbdo, String("/") + vuons[i] + "/status/connection", WiFi.status() == WL_CONNECTED ? 1 : 0);
            }
        }

        if (Firebase.ready()) {
            for (int i = 0; i < numVuons; i++) {
                Firebase.setInt(fbdo, String("/") + vuons[i] + "/status/connection", 1);
            }

            // Gửi dữ liệu cảm biến
            sendSensorData();

            // Điều khiển thiết bị
            controlDevice();
        } else {
            for (int i = 0; i < numVuons; i++) {
                Firebase.setInt(fbdo, String("/") + vuons[i] + "/status/connection", 0);
            }
        }
    }
}

void connectWiFi() {
    Serial.print("Đang kết nối WiFi...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    int retryCount = 0, maxRetries = 20;
    while (WiFi.status() != WL_CONNECTED && retryCount < maxRetries) {
        Serial.print(".");
        delay(500);
        retryCount++;
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nĐã kết nối WiFi! IP: " + WiFi.localIP().toString());
    } else {
        Serial.println("\nKhông thể kết nối WiFi!");
    }
}

void initializeFirebaseStates() {
    for (int i = 0; i < numVuons; i++) {
        String basePath = "/" + String(vuons[i]);
        Firebase.setFloat(fbdo, basePath + "/temp", 0.0);
        Firebase.setFloat(fbdo, basePath + "/humi", 0.0);
        Firebase.setFloat(fbdo, basePath + "/co2", 0.0);
        Firebase.setInt(fbdo, basePath + "/den", 0);
        Firebase.setInt(fbdo, basePath + "/quat", 0);
        Firebase.setInt(fbdo, basePath + "/tuoi", 0);
        Firebase.setInt(fbdo, basePath + "/status/connection", 0);

       
        json.clear();
        json.set("den", 0);
        json.set("quat", 0);
        json.set("tuoi", 0);
        Firebase.setJSON(fbdo, basePath + "/totalTime", json);

        Serial.println("Khởi tạo trạng thái Firebase cho " + String(vuons[i]) + " hoàn tất!");
    }
}

void sendSensorData() {
    // Đọc cảm biến DHT11
    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();
    // Đọc cảm biến MQ-2
    int mq2Value = analogRead(GAS_SENSOR_PIN);
    float co2PPM = map(mq2Value, 0, 4095, 0, 3000); // Mô phỏng CO2

    // Gửi dữ liệu chung cho tất cả phòng
    for (int i = 0; i < numVuons; i++) {
        String basePath = "/" + String(vuons[i]);
        if (!isnan(humidity) && !isnan(temperature)) {
            Firebase.setFloat(fbdo, basePath + "/temp", temperature);
            Firebase.setFloat(fbdo, basePath + "/humi", humidity);
            Serial.println(String(vuons[i]) + " - Nhiệt độ: " + String(temperature) + "°C, Độ ẩm: " + String(humidity) + "%");
        } else {
            Firebase.setString(fbdo, basePath + "/sensor_status", "DHT11 Error");
            Serial.println(String(vuons[i]) + " - Lỗi đọc DHT11!");
        }
        Firebase.setFloat(fbdo, basePath + "/co2", co2PPM);
        if (co2PPM > CO2_THRESHOLD) {
            // Sử dụng FirebaseJson để gửi log (bỏ timestamp)
            json.clear();
            json.set("message", "Nồng độ CO2 quá cao: " + String(co2PPM) + " ppm");
            Firebase.setJSON(fbdo, basePath + "/logs/" + String(millis()), json);
        }
        Serial.println(String(vuons[i]) + " - CO2: " + String(co2PPM) + " ppm");
    }
}

void controlDevice() {
    // Phòng 1
    String basePath = "/" + String(vuons[0]);
    if (Firebase.getInt(fbdo, basePath + "/den")) {
        int state = fbdo.intData();
        digitalWrite(DEN_1, state ? HIGH : LOW);
        Serial.println(String(vuons[0]) + " - ĐÈN: " + String(state ? "Bật" : "Tắt"));
    } else {
        Serial.println(String(vuons[0]) + " - Lỗi đọc trạng thái  ĐÈN!");
    }
    if (Firebase.getInt(fbdo, basePath + "/quat")) {
        int state = fbdo.intData();
        digitalWrite(QUAT_1, state ? HIGH : LOW);
        Serial.println(String(vuons[0]) + " - QUẠT: " + String(state ? "Bật" : "Tắt"));
    } else {
        Serial.println(String(vuons[0]) + " - Lỗi đọc trạng thái QUẠT!");
    }
    if (Firebase.getInt(fbdo, basePath + "/tuoi")) {
        int state = fbdo.intData();
        digitalWrite(TUOI_1, state ? HIGH : LOW);
        Serial.println(String(vuons[0]) + " - TƯỚI: " + String(state ? "Bật" : "Tắt"));
    } else {
        Serial.println(String(vuons[0]) + " - Lỗi đọc trạng thái TƯỚI!");
    }

    // Phòng 2
    basePath = "/" + String(vuons[1]);
    if (Firebase.getInt(fbdo, basePath + "/den")) {
        int state = fbdo.intData();
        digitalWrite(DEN_2, state ? HIGH : LOW);
        Serial.println(String(vuons[1]) + " - ĐÈN: " + String(state ? "Bật" : "Tắt"));
    } else {
        Serial.println(String(vuons[1]) + " - Lỗi đọc trạng thái ĐÈN!");
    }
    if (Firebase.getInt(fbdo, basePath + "/quat")) {
        int state = fbdo.intData();
        digitalWrite(QUAT_2, state ? HIGH : LOW);
        Serial.println(String(vuons[1]) + " - QUẠT: " + String(state ? "Bật" : "Tắt"));
    } else {
        Serial.println(String(vuons[1]) + " - Lỗi đọc trạng thái QUẠT!");
    }
    if (Firebase.getInt(fbdo, basePath + "/tuoi")) {
        int state = fbdo.intData();
        digitalWrite(TUOI_2, state ? HIGH : LOW);
        Serial.println(String(vuons[1]) + " - TƯỚI: " + String(state ? "Bật" : "Tắt"));
    } else {
        Serial.println(String(vuons[1]) + " - Lỗi đọc trạng thái TƯỚI!");
    }

    // Phòng 3
    basePath = "/" + String(vuons[2]);
    if (Firebase.getInt(fbdo, basePath + "/den")) {
        int state = fbdo.intData();
        digitalWrite(DEN_3, state ? HIGH : LOW);
        Serial.println(String(vuons[2]) + " - Thiết bị: " + String(state ? "Bật" : "Tắt"));
    } else {
        Serial.println(String(vuons[2]) + " - Lỗi đọc trạng thái  Thiết bị!");
    }
    if (Firebase.getInt(fbdo, basePath + "/quat")) {
        int state = fbdo.intData();
        digitalWrite(QUAT_3, state ? HIGH : LOW);
        Serial.println(String(vuons[2]) + " - QUẠT: " + String(state ? "Bật" : "Tắt"));
    } else {
        Serial.println(String(vuons[2]) + " - Lỗi đọc trạng thái QUẠT!");
    }
    if (Firebase.getInt(fbdo, basePath + "/tuoi")) {
        int state = fbdo.intData();
        digitalWrite(TUOI_3, state ? HIGH : LOW);
        Serial.println(String(vuons[2]) + " - TƯỚI: " + String(state ? "Bật" : "Tắt"));
    } else {
        Serial.println(String(vuons[2]) + " - Lỗi đọc trạng thái TƯỚI!");
    }

    // Phòng 4
    basePath = "/" + String(vuons[3]);
    if (Firebase.getInt(fbdo, basePath + "/den")) {
        int state = fbdo.intData();
        digitalWrite(DEN_4, state ? HIGH : LOW);
        Serial.println(String(vuons[3]) + " - ĐÈN: " + String(state ? "Bật" : "Tắt"));
    } else {
        Serial.println(String(vuons[3]) + " - Lỗi đọc trạng thái ĐÈN!");
    }
    if (Firebase.getInt(fbdo, basePath + "/quat")) {
        int state = fbdo.intData();
        digitalWrite(QUAT_4, state ? HIGH : LOW);
        Serial.println(String(vuons[3]) + " - QUẠT: " + String(state ? "Bật" : "Tắt"));
    } else {
        Serial.println(String(vuons[3]) + " - Lỗi đọc trạng thái QUẠT!");
    }
    if (Firebase.getInt(fbdo, basePath + "/tuoi")) {
        int state = fbdo.intData();
        digitalWrite(TUOI_4, state ? HIGH : LOW);
        Serial.println(String(vuons[3]) + " - TƯỚI: " + String(state ? "Bật" : "Tắt"));
    } else {
        Serial.println(String(vuons[3]) + " - Lỗi đọc trạng thái TƯỚI!");
    }
}