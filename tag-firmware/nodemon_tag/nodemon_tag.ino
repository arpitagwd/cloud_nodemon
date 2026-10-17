/*
 * Nodemon BLE asset tag (ESP32 DevKit, battery powered).
 * Wake every SLEEP_S seconds (or instantly when the tamper button changes) -> advertise ~3.5 s -> deep sleep.
 *
 * Wiring: push button between GPIO33 and GND (internal pull-up used). Pressed = tamper.
 * Optional battery sensing: 100k/100k divider from battery+ to GPIO34 to GND.
 *
 * Packet (manufacturer data, little-endian), parsed by the gateway:
 *   [0-1] 0xFFFF | [2-3] TAG_ID | [4] motion | [5] tamper | [6] battery %
 * The hardware has no accelerometer, so motion_flag is set together with tamper (button event).
 * Library: NimBLE-Arduino 1.4.x. Set TAG_ID per tag (must equal assets.tag_id in the database).
 */
#include <NimBLEDevice.h>
#include "driver/rtc_io.h"
#include "esp_sleep.h"

#define TAG_ID 1
constexpr gpio_num_t BTN_PIN = GPIO_NUM_33;
constexpr uint64_t SLEEP_S = 10;
constexpr uint32_t ADV_MS = 3500;
#define BATTERY_ADC_PIN 34           // comment out if no divider is fitted (battery then reports 100 = unknown)
constexpr uint8_t TAMPER_HOLD_CYCLES = 2;   // repeat the flag over 2 broadcasts so one lost advert is not fatal

RTC_DATA_ATTR uint8_t tamperHold = 0;

uint8_t batteryPct() {
#ifdef BATTERY_ADC_PIN
  uint32_t mv = analogReadMilliVolts(BATTERY_ADC_PIN) * 2;   // 1:2 divider
  if (mv <= 3300) return 0;
  if (mv >= 4200) return 100;
  return (uint8_t)((mv - 3300) * 100 / 900);
#else
  return 100;
#endif
}

void setup() {
  esp_sleep_wakeup_cause_t cause = esp_sleep_get_wakeup_cause();
  rtc_gpio_deinit(BTN_PIN);
  pinMode(BTN_PIN, INPUT_PULLUP);
  delay(5);
  bool pressed = digitalRead(BTN_PIN) == LOW;
  if (pressed || cause == ESP_SLEEP_WAKEUP_EXT0) tamperHold = TAMPER_HOLD_CYCLES;
  uint8_t tamper = tamperHold > 0 ? 1 : 0;
  if (tamperHold > 0) tamperHold--;

  std::string md;
  md.push_back((char)0xFF); md.push_back((char)0xFF);                    // company id 0xFFFF
  md.push_back((char)(TAG_ID & 0xFF)); md.push_back((char)(TAG_ID >> 8)); // tag_id
  md.push_back((char)tamper);                                            // motion (button event)
  md.push_back((char)tamper);                                            // tamper
  md.push_back((char)batteryPct());

  NimBLEDevice::init("");
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);
  NimBLEAdvertising *adv = NimBLEDevice::getAdvertising();
  NimBLEAdvertisementData ad;
  ad.setManufacturerData(md);
  adv->setAdvertisementData(ad);
  adv->setAdvertisementType(BLE_GAP_CONN_MODE_NON);   // beacon only, no connections
  adv->setMinInterval(0x30); adv->setMaxInterval(0x50);
  adv->start();
  delay(ADV_MS);
  adv->stop();

  esp_sleep_enable_timer_wakeup(SLEEP_S * 1000000ULL);
  if (digitalRead(BTN_PIN) == HIGH) {   // only arm the button wake if released, else it would wake in a loop
    rtc_gpio_pullup_en(BTN_PIN); rtc_gpio_pulldown_dis(BTN_PIN);
    esp_sleep_enable_ext0_wakeup(BTN_PIN, 0);
  }
  esp_deep_sleep_start();
}

void loop() {}
