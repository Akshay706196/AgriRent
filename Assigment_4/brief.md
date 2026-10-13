# AgriRent System Brief

## 1. What the System Does
AgriRent ek web-based peer-to-peer agricultural equipment rental marketplace hai. Yeh verified users ko heavy farming machines jaise tractors, harvesters aur rotavators rent par lene aur rent par dene ki facility deta hai. System date-based availability check karta hai, overlapping bookings rokta hai, owner approval mandatory banata hai (24-hour response SLA), 100% online payments handle karta hai, handover aur return ke waqt system-generated one-time PINs verify karta hai, late fines evaluate karta hai, damage claims capture karta hai aur security deposit settle karta hai.

## 2. Who Uses It
* **Renter (User):** Kisaan jo required time frame ke liye agricultural equipment search aur book karta hai.
* **Equipment Owner (User):** Machine owner jo farming equipment list karta hai, rental rates aur deposit set karta hai aur requests accept/reject karta hai.
* **Single-Account Dual-Role User:** Ek hi user jo platform par machinery rent par le bhi sakta hai aur apna personal equipment list bhi kar sakta hai.
* **Administrator:** Platform manager jo user KYC verify karta hai, disputes arbitrate karta hai aur audit logs monitor karta hai.

---

## 3. Nouns (The Entities & Resources)
* **User:** Multi-context entity jisme identity credentials, role, kycStatus aur accountStatus store hote hain.
* **KYC:** Identity documents submission aur admin verification status records.
* **Equipment:** Agricultural machinery listing jisme category, photos, condition, pricePerDay, pickupAddress aur terms shamil hain.
* **Booking:** Core transactional record jisme dates, duration, price snapshot, securityDeposit, platformFee (3%) aur lifecycle states hote hain.
* **Payment:** Online financial transactions (RENTAL, DEPOSIT, REFUND, SETTLEMENT, DAMAGE_DEDUCTION).
* **SecurityDeposit:** Held deposit balance, damage deductions aur return refund records.
* **HandoverPIN / ReturnPIN:** Transaction-specific single-use verification tokens jo machine handover aur safe return validate karte hain.
* **DamageClaim:** Post-rental evidence-backed damage deduction claim jisme photos, reason aur claimed amount shamil hai.
* **Dispute:** Deduction ya charges ke against raised issue jo admin decision ke liye hold hota hai.
* **Review:** Rental completion ke baad submit ki gayi rating (1-5) aur feedback.
* **Notification:** In-app aur email system alerts.
* **AuditLog:** Sensitive operations aur administrative decisions ka immutable history record.

---

## 4. Verbs (The Actions & Contracts)
* **RegisterUser / VerifyKYC:** Account create karna aur identity proofs authenticate karna.
* **ListEquipment:** Farm machinery details, daily rental rate aur security deposit set karke publish karna.
* **SearchEquipment:** Category, availability dates aur location distance filters ke according equipment query karna.
* **RequestBooking:** Dates select karke rental duration aur applicable charges estimate ke saath booking initiate karna.
* **ApproveBooking / RejectBooking:** Owner dwara 24 ghante ke andar request accept ya decline karna.
* **AuthorizePayment:** Payment gateway ke through advance rental aur security deposit safely hold karna.
* **VerifyHandoverPIN:** Machine handover point par renter PIN match karke booking state ko IN_RENTAL me update karna.
* **VerifyReturnPIN:** Machine return ke waqt owner dwara return PIN match karke return timestamp record karna.
* **CalculateLateFine:** Return deadline cross hone par configured per-day rate se penalty evaluate karna.
* **SubmitDamageClaim:** Damage hone par condition photos aur estimated repair claim submit karna.
* **RaiseDispute:** Unauthorized damage fine ke against transaction hold karwana.
* **SettlePayment:** Deductions aur fines adjust karke deposit release karna aur payout complete karna.
* **SubmitReview:** Completed booking ke baad owner aur renter ka ek dusre ko rate karna.