# EggTrack Pro - Inventory & Sales Management System 🥚

A lightweight, modern web application for managing egg inventory, sales, and expenses using Alpine.js and Tailwind CSS.

## Features

✅ **Dashboard Metrics**
- Cash on Hand (Revenue - Expenses)
- Net Profit (Revenue - COGS)
- Accounts Receivable (Unpaid Loans)
- Current Stock Level

✅ **Sales Management**
- Record regular or loaned sales
- Dynamic pricing based on sale type
- Track payment status
- Collect outstanding loans

✅ **Inventory Management**
- Real-time stock tracking
- Automatic inventory updates on sales and restocking
- Quick restock functionality

✅ **Expense Tracking**
- Categorize expenses (Transportation, Utilities, Maintenance, Feed Supplies, Veterinary)
- Automatic restocking cost tracking
- Detailed expense ledger

✅ **Data Persistence**
- LocalStorage integration for seamless data saving
- No backend required - pure client-side app

✅ **Dark Mode**
- Toggle between light and dark themes
- Persistent theme preference

## Technologies Used

- **Frontend:** HTML5, Alpine.js 3.x, Tailwind CSS
- **Icons:** Lucide Icons
- **Storage:** Browser LocalStorage
- **Styling:** Utility-first CSS

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/kiiing025/egg-inventory-system.git
cd egg-inventory-system
```

2. Open the application:
```bash
# Using Python
python -m http.server 8000

# Or with Node.js
npx http-server

# Or simply open index.html in your browser
```

3. Visit `http://localhost:8000` in your web browser

## Usage

### Recording a Sale
1. Enter customer name
2. Select sale type (Regular or Loaned)
3. Enter quantity
4. Click "Record Sale"
- Regular sales are marked as PAID automatically
- Loaned sales can be collected later

### Restocking
1. Enter quantity to purchase
2. Enter cost per unit
3. Click "Restock Now"
- Total cost is automatically logged as a "Restocking Cost" expense
- Inventory is immediately updated

### Recording Expenses
1. Select expense category
2. Enter amount
3. Add notes (optional)
4. Click "Record Expense"

### Collecting Loans
- Navigate to "Sales Ledger" tab
- Find loaned sales marked as UNPAID
- Click "COLLECT" button to mark as paid

## Data Structure

All data is stored in LocalStorage under:
- `egg_app_data` - Main app state (inventory, sales, expenses, config)
- `egg_dark_mode` - Theme preference

## Bug Fixes Applied

✅ Fixed nullish coalescing operator syntax errors (lines 290-292)
- Changed `? ?` to `??` for proper null/undefined handling

## Features Planned

- Export reports as PDF/CSV
- Monthly analytics dashboard
- Customer history tracking
- Profit margin calculations
- Data backup/restore functionality

## License

MIT License - Feel free to use for personal or commercial purposes

---

**Made with ❤️ for egg business management**
