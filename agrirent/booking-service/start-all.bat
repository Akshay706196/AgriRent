
@echo off
title AgriRentt - Start All Services

set "ROOT=C:\Users\Abhinav\OneDrive\Documents\AgriRentt"

echo ======================================
echo       STARTING AGRIRENTT PROJECT
echo ======================================

start "Equipment Service" cmd /k "cd /d "%ROOT%\equipment-service" && npm run dev"

start "Booking Service" cmd /k "cd /d "%ROOT%\booking-service" && npm run dev"

start "Identity KYC Service" cmd /k "cd /d "%ROOT%\identity-kyc-service" && npm run dev"

start "Payment Service" cmd /k "cd /d "%ROOT%\payment-service" && npm run dev"

start "Handover Service" cmd /k "cd /d "%ROOT%\handover-service" && npm run dev"

start "Claims Service" cmd /k "cd /d "%ROOT%\claims-service" && npm run dev"

start "AgriRentt Frontend" cmd /k "cd /d "%ROOT%\frontend" && npm run dev"

echo.
echo All startup commands have been launched!
pause

