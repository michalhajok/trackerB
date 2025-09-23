# Portfolio Manager - Backend (Express.js + MongoDB)

## 🚀 Instalacja i Uruchomienie

### 1. Wymagania
- Node.js 18+
- MongoDB (lokalny lub MongoDB Atlas)
- npm lub yarn

### 2. Instalacja zależności
```bash
cd backend
npm install
```

### 3. Konfiguracja środowiska
Utwórz plik `.env` na podstawie `.env.example`:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/portfolio_manager
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d
```

### 4. Uruchomienie
```bash
# Development
npm run dev

# Production
npm start
```

## 📁 Struktura Projektu

```
backend/
├── server.js                 # Główny plik serwera
├── package.json              # Zależności i skrypty
├── .env.example              # Przykład konfiguracji środowiska
├── middleware/
│   ├── auth.js               # JWT authentication
│   ├── validation.js         # Walidacja danych
│   └── errorHandler.js       # Obsługa błędów
├── models/
│   ├── User.js               # Model użytkownika
│   ├── Position.js           # Model pozycji
│   ├── CashOperation.js      # Model operacji gotówkowych
│   ├── PendingOrder.js       # Model zleceń oczekujących
│   └── FileImport.js         # Model importów plików
├── routes/
│   ├── auth.js               # Endpoints autoryzacji
│   ├── positions.js          # Endpoints pozycji
│   ├── cashOperations.js     # Endpoints operacji gotówkowych
│   ├── pendingOrders.js      # Endpoints zleceń oczekujących
│   ├── analytics.js          # Endpoints analityki
│   └── fileImport.js         # Endpoints importu plików
├── controllers/
│   ├── authController.js     # Logika autoryzacji
│   ├── positionsController.js # Logika pozycji
│   ├── cashOperationsController.js
│   ├── pendingOrdersController.js
│   ├── analyticsController.js
│   └── fileImportController.js
└── utils/
    ├── database.js           # Połączenie z bazą danych
    ├── excel.js              # Parsowanie plików Excel
    └── calculations.js       # Kalkulacje finansowe
```

## 🔧 API Endpoints

### Autoryzacja
- `POST /api/auth/register` - Rejestracja użytkownika
- `POST /api/auth/login` - Logowanie
- `POST /api/auth/logout` - Wylogowanie
- `POST /api/auth/refresh` - Odświeżenie tokena
- `GET /api/auth/me` - Profil użytkownika

### Pozycje
- `GET /api/positions` - Lista pozycji (query: status=open/closed)
- `GET /api/positions/:id` - Szczegóły pozycji
- `POST /api/positions` - Utworzenie pozycji
- `PUT /api/positions/:id` - Aktualizacja pozycji
- `DELETE /api/positions/:id` - Usunięcie pozycji
- `PUT /api/positions/:id/close` - Zamknięcie pozycji

### Operacje Gotówkowe
- `GET /api/cash-operations` - Lista operacji
- `GET /api/cash-operations/:id` - Szczegóły operacji
- `POST /api/cash-operations` - Utworzenie operacji
- `PUT /api/cash-operations/:id` - Aktualizacja operacji
- `DELETE /api/cash-operations/:id` - Usunięcie operacji

### Zlecenia Oczekujące
- `GET /api/pending-orders` - Lista zleceń
- `GET /api/pending-orders/:id` - Szczegóły zlecenia
- `POST /api/pending-orders` - Utworzenie zlecenia
- `PUT /api/pending-orders/:id` - Aktualizacja zlecenia
- `DELETE /api/pending-orders/:id` - Usunięcie zlecenia
- `PUT /api/pending-orders/:id/execute` - Wykonanie zlecenia

### Analityka
- `GET /api/analytics/dashboard` - Dane dla dashboard
- `GET /api/analytics/performance` - Dane wydajności
- `GET /api/analytics/allocation` - Alokacja portfela
- `GET /api/analytics/statistics` - Szczegółowe statystyki

### Import Plików
- `POST /api/import/upload` - Upload pliku Excel
- `GET /api/import/history` - Historia importów
- `GET /api/import/:id/status` - Status importu

## 🛠️ Kluczowe Funkcjonalności

### Security Features
- JWT Authentication z refresh tokens
- Password hashing z bcrypt
- Rate limiting (100 requests/15min per IP)
- CORS protection
- Helmet security headers
- Input sanitization i validation

### Data Models
- **User**: name, email, password (hashed), refreshToken
- **Position**: symbol, type (BUY/SELL), volume, prices, P&L calculations
- **CashOperation**: type (deposit/withdrawal/dividend), amount, comment
- **PendingOrder**: symbol, type, price, status
- **FileImport**: filename, import status, records count

### Automatic Calculations
- P&L dla pozycji otwartych i zamkniętych
- Portfolio value calculation
- Performance metrics
- Risk assessment

### File Import Support
- Excel (.xlsx) file parsing
- Automatic data validation
- Bulk operations
- Import status tracking

## 🚦 Status Codes
- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

## 📊 Sample Data
Backend zawiera przykładowe dane dla:
- 2 pozycje otwarte
- 1 pozycja zamknięta
- 2 operacje gotówkowe (depozyty)

## 🔍 Monitoring i Logging
- Request/Response logging
- Error tracking
- Performance monitoring
- Database connection status

## 🧪 Testing
```bash
# Uruchom testy
npm test

# Testy z coverage
npm run test:coverage
```

## 🚀 Deployment
Backend jest gotowy do deploymentu na platformach typu:
- Heroku
- Railway
- DigitalOcean App Platform
- AWS Elastic Beanstalk

Konfiguruj zmienne środowiskowe zgodnie z wybraną platformą.