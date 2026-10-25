-- Database schema for AgriRent Machinery Entity
DROP TABLE IF EXISTS equipments;

CREATE TABLE equipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    daily_rate REAL NOT NULL,
    is_available BOOLEAN DEFAULT 1
);

-- Seed data: 4 initial rental implements
INSERT INTO equipments (name, category, daily_rate, is_available) VALUES 
('Mahindra 575 DI Tractor', 'Tractor', 1800.0, 1),
('John Deere Combine Harvester', 'Harvester', 4500.0, 1),
('Shaktiman Rotavator 7 Feet', 'Tillage', 1200.0, 1),
('Kubota Rice Transplanter', 'Seeding', 2200.0, 0);