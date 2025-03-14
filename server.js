const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session'); 
const app = express();

const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Masilo@96',
  database: 'quotings',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})
async function executeQuery(query, params = []) {
  try {
    const [results] = await db.promise().execute(query, params);
    return results;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

app.use(bodyParser.urlencoded({ extended: false }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
// Session setup
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));
// ✅ Home (Login Page)
app.get('/', async (req, res) => {
  try {
    const salePeoples = await executeQuery('SELECT sale_person FROM salePeople');
    res.render('login', { salePeoples });
  } catch (error) {
    console.error('Error fetching salePeople:', error);
    res.status(500).send('Error fetching salePeople');
  }
});
// ✅ Signup Page - Fetch Dropdown Data
app.get('/signup', async (req, res) => {
  try {
    const salePeoples = await executeQuery('SELECT sale_person, sale_cell, sale_email, saleRole FROM salePeople');
    const installDifficultyTypes = await executeQuery('SELECT install_diff FROM InstallDifficultyType');
    const slaMlaTypes = await executeQuery('SELECT sla_mla FROM SlaMlaType');
    const validateNumTypes = await executeQuery('SELECT validate_num_days FROM ValidateNumType');
    const productTypes = await executeQuery('SELECT product_type FROM ProductType');
    const supplyTypes = await executeQuery('SELECT supply FROM SupplyType');

    res.render('signup', { salePeoples, installDifficultyTypes, slaMlaTypes, validateNumTypes, productTypes, supplyTypes });
  } catch (error) {
    console.error('Error fetching signup data:', error);
    res.status(500).send('Error fetching data for signup');
  }
});
// ✅ Signup - Save Data
app.post('/signup', async (req, res) => {
  try {
    const { reference, job_description, customer_name, customer_cell, customer_email, sale_person, sale_cell, sale_email, saleRole } = req.body;

    if (!reference || !job_description || !customer_name || !customer_cell || !customer_email || !sale_person || !sale_cell || !sale_email || !saleRole) {
      return res.status(400).send('All fields are required.');
    }

    const existingRef = await executeQuery('SELECT reference FROM quote_details WHERE reference = ?', [reference]);
    if (existingRef.length > 0) {
      return res.status(400).send('Reference already exists. Please use a different one.');
    }

    const query = `INSERT INTO quote_details (reference, job_description, customer_name, customer_cell, customer_email, sale_person, sale_cell, sale_email, saleRole)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await executeQuery(query, [reference, job_description, customer_name, customer_cell, customer_email, sale_person, sale_cell, sale_email, saleRole]);

    res.redirect('/');
  } catch (error) {
    console.error('Error saving signup data:', error);
    res.status(500).send('Error saving data');
  }
});
// ✅ Login
app.get('/login', async (req, res) => {
  try {
    const salePeoples = await executeQuery('SELECT sale_person FROM salePeople');
    res.render('login', { salePeoples });
  } catch (error) {
    console.error('Error fetching salePeople:', error);
    res.status(500).send('Error fetching salePeople');
  }
});
app.post('/login', async (req, res) => {
  const { reference, sale_person } = req.body;

  try {
    const results = await executeQuery('SELECT * FROM quote_details WHERE reference = ? AND sale_person = ?', [reference, sale_person]);

    if (results.length > 0) {
      req.session.user = { reference: results[0].reference, sale_person: results[0].sale_person };
      req.session.userReference = results[0].reference; 
      req.session.save(() => {
        res.render('homepage', { data: results[0] });
      });
    } else {
      res.send('Invalid credentials');
    }
  } catch (error) {
    console.error('Error checking login credentials:', error);
    res.send('Database error');
  }
});
// ✅ Homepage
app.get('/homepage', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('homepage');
});
// ✅ Print Page
app.get('/print', async (req, res) => {
  const userRefNum = req.session.user?.reference;

  if (!userRefNum) return res.redirect('/');

  try {
    const itemsResult = await executeQuery(`
      SELECT i.bill, i.stock_code, i.description, i.qty, i.product_type, i.unit_cost, 
             q.customer_name, q.customer_email, q.sale_person, q.sale_cell, q.job_description
      FROM items i
      JOIN quote_details q ON i.reference = q.reference
      WHERE i.reference = ?
      ORDER BY i.bill, i.reference
    `, [userRefNum]);

    if (itemsResult.length === 0) return res.send('No items found for this reference.');

    const bills = itemsResult.reduce((acc, item) => {
      const bill = item.bill || 'Unknown Bill';
      if (!acc[bill]) acc[bill] = [];
      acc[bill].push(item);
      return acc;
    }, {});

    const groupedItems = {
      reference: userRefNum,
      customer_name: itemsResult[0]?.customer_name || '',
      customer_email: itemsResult[0]?.customer_email || '',
      sale_person: itemsResult[0]?.sale_person || '',
      sale_cell: itemsResult[0]?.sale_cell || '',
      job_description: itemsResult[0]?.job_description || '',
      bills: Object.keys(bills).map(billName => ({
        bill: billName,
        items: bills[billName].map(item => ({
          ...item,
          total_price: (parseFloat(item.unit_cost || 0) * parseFloat(item.qty || 0)).toFixed(2)
        })),
        subtotal: bills[billName]
          .reduce((sum, item) => sum + (parseFloat(item.unit_cost || 0) * parseFloat(item.qty || 0)), 0)
          .toFixed(2)
      }))
    };

    res.render('print', { groupedItems });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.send('Error retrieving items data.');
  }
});

// ✅ Delete All Items
app.post('/delete-all-items/:reference', async (req, res) => {
  const { reference } = req.params;
  try {
    await executeQuery('DELETE FROM items WHERE reference = ?', [reference]);
    res.redirect('/');
  } catch (error) {
    console.error('Error deleting items:', error);
    res.send('Error deleting items.');
  }
});
// ✅ Add Items
app.get('/additems', async (req, res) => { // Added "async"
  try {
    const salePeoples = await executeQuery('SELECT sale_person, sale_cell, sale_email, saleRole FROM salePeople');
    const installDifficultyTypes = await executeQuery('SELECT install_diff FROM InstallDifficultyType');
    const slaMlaTypes = await executeQuery('SELECT sla_mla FROM SlaMlaType');
    const validateNumTypes = await executeQuery('SELECT validate_num_days FROM ValidateNumType');
    const productTypes = await executeQuery('SELECT product_type FROM ProductType');
    const supplyTypes = await executeQuery('SELECT supply FROM SupplyType');

    const reference = req.query.reference; 
    if (!reference) {
      return res.send('Error: No reference provided.');
    }

    res.render('additems', { reference, salePeoples, installDifficultyTypes, slaMlaTypes, validateNumTypes, productTypes, supplyTypes });
  } catch (error) { 
    console.error('Database error:', error);
    res.status(500).send('Database error');
  }
});
app.post('/additems', async (req, res) => {
  try {
    const { reference, bill, stock_code, description, qty, product_type, install_diff, unit_cost, supply, labour_hrs, labour_cost } = req.body;

    if (!reference) {
      return res.send('Error: Reference is missing.');
    }
    const referenceResult = await executeQuery(`SELECT * FROM Quote_details WHERE reference = ?`, [reference]);

    if (referenceResult.length === 0) {
      return res.send('Error: Reference does not exist in Quote_details');
    }
    const billResult = await executeQuery(`SELECT * FROM Bills WHERE bill = ? AND reference = ?`, [bill, reference]);

    if (billResult.length === 0) {
      await executeQuery(
        `INSERT INTO Bills (bill, reference, labour_hrs, labour_cost) VALUES (?, ?, ?, ?)`,
        [bill, reference, labour_hrs || 0, labour_cost || 0]
      );
      console.log('Bill inserted successfully');
    }

    await executeQuery(
      `INSERT INTO Items (reference, bill, stock_code, description, qty, product_type, install_diff, unit_cost, supply)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reference, bill, stock_code, description, qty, product_type, install_diff, unit_cost, supply]
    );

    res.redirect('/login');
  } catch (error) {
    console.error(error);
    res.send('Database error while processing request');
  }
});

app.get('/billing', async (req, res) => {
  try {
    res.render('billing');
  } catch (error) {
    console.error('Error rendering billing page:', error);
    res.status(500).send('Something went wrong while rendering the billing page.');
  }
});
app.get('/allitems', async (req, res) => {
  const loggedInReference = req.session.user?.reference;

  if (!loggedInReference) {
    return res.status(401).send('Unauthorized: No reference found');
  }

  const query = 'SELECT * FROM Items WHERE reference = ? ORDER BY bill, reference';

  db.query(query, [loggedInReference], (error, results) => {
    if (error) {
      console.error('Database error:', error);
      return res.status(500).send('Database error');
    }

    let groupedItems = {}; 

    results.forEach(item => {
      if (!groupedItems[item.bill]) {
        groupedItems[item.bill] = [];
      }
      groupedItems[item.bill].push(item);
    });

    res.render('allitems', { groupedItems });
  });
});
// Edit item route (GET)
app.get('/edit-item/:id', async (req, res) => {
  const itemId = req.params.id;
  const userReference = req.session.user?.reference;
  if (!userReference) {
    return res.status(403).send('Unauthorized access');
  }
  try {
    const salePeoples = await executeQuery('SELECT sale_person, sale_cell, sale_email, saleRole FROM salePeople');
    const installDifficultyTypes = await executeQuery('SELECT install_diff FROM InstallDifficultyType');
    const slaMlaTypes = await executeQuery('SELECT sla_mla FROM SlaMlaType');
    const validateNumTypes = await executeQuery('SELECT validate_num_days FROM ValidateNumType');
    const productTypes = await executeQuery('SELECT product_type FROM ProductType');
    const supplyTypes = await executeQuery('SELECT supply FROM SupplyType');

    const query = `
      SELECT i.id_items, i.reference, i.stock_code, i.description, i.qty, 
             i.product_type, i.install_diff, i.unit_cost, i.supply
      FROM Items i
      JOIN quote_details q ON i.reference = q.reference
      WHERE i.id_items = ? AND i.reference = ?`;

    const [results] = await db.promise().execute(query, [itemId, userReference]);

    if (results.length === 0) {
      return res.status(404).send('Item not found or unauthorized');
    }

    res.render('edititem', { 
      item: results[0], 
      salePeoples, 
      installDifficultyTypes, 
      slaMlaTypes, 
      validateNumTypes, 
      productTypes, 
      supplyTypes 
    });

  } catch (error) {
    console.error('Error fetching data for edit-item:', error);
    res.status(500).send('Error fetching data for edit-item');
  }
});
// Edit item route (POST)
app.post('/edit-item/:id', async (req, res) => {
  const itemId = req.params.id;  
  const userReference = req.session.user?.reference;
  if (!userReference) {
    return res.status(403).send('Unauthorized access');
  }
  const { stock_code,description, qty, product_type, install_diff, unit_cost, supply } = req.body;
  const updateQuery = `
    UPDATE Items
    SET stock_code = ?, description = ?, qty = ?, product_type = ?, install_diff = ?, unit_cost = ?, supply = ?
    WHERE id_items = ? AND reference = ?`;
  try {
    const [updateResult] = await db.promise().execute(updateQuery, [stock_code, description, qty, product_type, install_diff, unit_cost, supply, itemId, userReference]);
    if (updateResult.affectedRows === 0) {
      return res.status(404).send('Item not found or unauthorized');
    }
    res.redirect('/allitems');
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).send('Error updating item');
  }
});

app.post('/delete-item/:id', async (req, res) => {
  const itemId = req.params.id;  
  const userReference = req.session.user?.reference;  

  if (!userReference) {
    return res.status(403).send('Unauthorized access');
  }

  const deleteQuery = `
    DELETE FROM Items 
    WHERE id_items = ? AND reference = ?`;

  try {
  
    const [deleteResult] = await db.promise().execute(deleteQuery, [itemId, userReference]);

    if (deleteResult.affectedRows === 0) {
      return res.status(404).send('Item not found or unauthorized');
    }

    res.redirect('/allitems');
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).send('Error deleting item');
  }
});

app.get('/overview', (req, res) => {
  res.render('overview'); 
});
// ✅ Start Server
app.listen(1200, () => {
  console.log('Server running on http://localhost:1200');
});
