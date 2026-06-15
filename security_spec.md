# Security Spec

## Data Invariants
1. `apps` can only be created, modified, or deleted by an administrator.
2. `apps` documents must strictly adhere to the `appReview` schema (name, logo, apkUrl, createdAt, updatedAt required).
3. The `admins` collection can only be populated or modified by administrators (and inherently bootstrapped by the hardcoded admin email).
4. `apps` can be read (list and get) by anyone (publicly accessible).
5. Admins list can only be read by administrators.

## Dirty Dozen Payloads
1. Create `app` by non-admin -> PERMISSION DENIED
2. Update `app` by non-[admin] -> PERMISSION_DENIED
3. Delete `app` by non-[admin] -> PERMISSION_DENIED
4. Create `app` missing `name` field -> PERMISSION_DENIED
5. Create `app` with `methods` as a string instead of array -> PERMISSION_DENIED
6. Update `app` giving an extra ghost field `isVerified` -> PERMISSION_DENIED
7. Update `app` with `createdAt` not equal to existing -> PERMISSION_DENIED
8. Create `admin` doc with email spoofing by a non-admin -> PERMISSION_DENIED
9. Admin attempts to create `admin` document with unverified email -> PERMISSION_DENIED
10. Creating `app` with timestamp from client instead of request.time -> PERMISSION_DENIED
11. Reading `admins` list by anonymous user -> PERMISSION_DENIED
12. Attempt to create an `app` whose ID is poisoned (e.g. > 128 characters) -> PERMISSION_DENIED
