-- 1. USER SERVICE DATABASE
CREATE TABLE users (
    user_id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    kyc_status VARCHAR(20) DEFAULT 'PENDING',
    account_status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE kyc_records (
    kyc_id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    provider_ref VARCHAR(100),
    verification_status VARCHAR(20) NOT NULL,
    verified_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- 2. CATALOGUE SERVICE DATABASE
CREATE TABLE equipment (
    equipment_id VARCHAR(36) PRIMARY KEY,
    owner_id VARCHAR(36) NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    price_per_day DECIMAL(10, 2) NOT NULL,
    security_deposit DECIMAL(10, 2) NOT NULL,
    late_fine_per_day DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE'
);

CREATE TABLE equipment_availability_locks (
    lock_id VARCHAR(36) PRIMARY KEY,
    equipment_id VARCHAR(36) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_locked BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
);

-- 3. BOOKING SERVICE DATABASE
CREATE TABLE bookings (
    booking_id VARCHAR(36) PRIMARY KEY,
    renter_id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    equipment_id VARCHAR(36) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    number_of_days INT NOT NULL,
    rental_amount DECIMAL(10, 2) NOT NULL,
    security_deposit DECIMAL(10, 2) NOT NULL,
    platform_fee DECIMAL(10, 2) NOT NULL,
    handover_pin VARCHAR(6),
    return_pin VARCHAR(6),
    status VARCHAR(25) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. PAYMENT SERVICE DATABASE
CREATE TABLE payment_transactions (
    transaction_id VARCHAR(36) PRIMARY KEY,
    booking_id VARCHAR(36) NOT NULL,
    payer_id VARCHAR(36) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_type VARCHAR(30) NOT NULL,
    gateway_reference VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);