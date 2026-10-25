# CS543 Assignment 7: AgriRent GraphQL Service

**Student Name:** Akshay Kumar  
**Domain:** AgriRent (Agricultural Machinery Rental System)  
**Selected Entity:** Equipment / Machinery Catalogue  

**Demonstration Video Link:
https://drive.google.com/file/d/1EipLCrx4B1qiUlNRWuK9TF5ZU-YgGfZC/view?usp=sharing

---

## Answers to Mandatory Questions

### 1. Which service did you pick?
We picked the **AgriRent Equipment Catalogue Service**. It manages the machinery specifications, daily rental pricing, equipment categories (Tractor, Harvester, Tillage), and availability states for farmers.

### 2. Name one field a client can skip and one it cannot (why we use the "!" sign).
* **Cannot Skip (`!` Non-null):** The `name: String!` and `daily_rate: Float!` fields cannot be omitted. The exclamation mark `!` in GraphQL signifies a mandatory non-nullable constraint. If a client attempts to execute `addEquipment` without a machine name or rental rate, GraphQL's schema validation rejects the execution before reaching the resolver.
* **Can Skip (Nullable / Defaulted):** The `is_available: Boolean = true` field in `AddEquipmentInput` can be skipped by the client. If omitted, GraphQL automatically assigns the default value (`true`). In Query responses, filtering by `onlyAvailable: Boolean` is also optional.

### 3. Map it to SQL: which part of your query became the WHERE, and which resolver ran the INSERT?
* **SQL WHERE Clause Mapping:** In the `equipments(onlyAvailable: Boolean)` query, the optional argument `onlyAvailable` mapped directly to:
  ```sql
  SELECT * FROM equipments WHERE is_available = ?