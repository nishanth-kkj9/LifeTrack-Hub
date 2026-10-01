# LifeTrack Hub — Cryptographic & Data Protection Boundary (Phase 2C.2)

## 1. Current State of Transport & Remote Storage Security
* **Network Transport Layer**: All communication between client applications (Android, Windows Desktop, React Web) and Firebase Firestore / Google Identity services is strictly encrypted in transit using **TLS 1.3 / HTTPS**.
* **Access Control & Authorization**: Authorization is governed by **Zero-Trust ABAC Firestore Security Rules (`firestore.rules`)** bound to the authenticated user's Firebase UID (`request.auth.uid == userId`). Cross-user reads and writes are blocked by default.
* **Application Payloads in Phase 2C.2**: Delta record payloads (`payload`) are serialized **plaintext UTF-8 JSON**. 
* **Honest Disclosure**: **End-to-End Encryption (E2EE) with client-side key derivation is NOT enabled in Phase 2C.2.** LifeTrack Hub does not claim Firestore stores encrypted application payloads at this stage.

## 2. Prepared Architecture for Phase 3 E2EE
The canonical delta contract (`SyncRecord`) and transport boundary are explicitly prepared for Phase 3 client-side envelope encryption:

```text
Current Wire Format (Phase 2C.2):
{
  "id": "evt_...",
  "entityType": "TASK",
  "entityId": "task-1",
  "operation": "UPSERT",
  "payload": "{\"title\":\"Review Algorithms\"}",  <-- Plaintext JSON payload
  "hlcTimestamp": "1720000000000:0:nodeA",
  ...
}

Future E2EE Wire Format (Phase 3):
{
  "id": "evt_...",
  "entityType": "TASK",
  "entityId": "task-1",
  "operation": "UPSERT",
  "payload": "<base64_aes_256_gcm_ciphertext>",
  "keyVersion": 1,
  "iv": "<base64_nonce>",
  "authTag": "<base64_tag>",
  ...
}
```

## 3. Platform Key Storage Boundary
* **Android**: `AndroidSecureKeyStorage` utilizes Android Keystore (`MasterKey` with AES-256 GCM) via `EncryptedSharedPreferences`.
* **Windows Desktop**: `DesktopSecureKeyStorage` provides the in-memory hardware vault abstraction interface; production DPAPI (`CryptProtectData`) will be bound in Phase 3 alongside Argon2id master key derivation.
