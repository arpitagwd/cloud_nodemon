#pragma once
#include <Arduino.h>
#include "mbedtls/base64.h"
#include "mbedtls/md.h"

static String urlEncode(const String &s) {
  String o; char buf[4];
  for (size_t i = 0; i < s.length(); i++) {
    char c = s[i];
    if (isalnum((unsigned char)c) || c == '-' || c == '_' || c == '.' || c == '~') o += c;
    else { snprintf(buf, sizeof buf, "%%%02X", (uint8_t)c); o += buf; }
  }
  return o;
}

// Builds an IoT Hub device SAS token valid until `expiry` (unix seconds). Needs NTP-synced time.
static String makeSasToken(const char *host, const char *deviceId, const char *b64Key, time_t expiry) {
  String enc = urlEncode(String(host) + "/devices/" + deviceId);
  String toSign = enc + "\n" + String((unsigned long)expiry);

  uint8_t key[64]; size_t keyLen = 0;
  if (mbedtls_base64_decode(key, sizeof key, &keyLen, (const uint8_t *)b64Key, strlen(b64Key)) != 0) return "";

  uint8_t mac[32];
  mbedtls_md_hmac(mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), key, keyLen,
                  (const uint8_t *)toSign.c_str(), toSign.length(), mac);

  uint8_t b64[64]; size_t n = 0;
  mbedtls_base64_encode(b64, sizeof b64, &n, mac, sizeof mac);
  String sig; for (size_t i = 0; i < n; i++) sig += (char)b64[i];

  return "SharedAccessSignature sr=" + enc + "&sig=" + urlEncode(sig) + "&se=" + String((unsigned long)expiry);
}
