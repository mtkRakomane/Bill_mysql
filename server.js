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
  secret: 'masilothabangkennedyrakomane@967',
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
app.get('/homepage', async (req, res) => {
  try {
    const reference = req.query.reference; // or get it from session/other means
    if (!reference) {
      return res.send('Error: No reference provided.');
    }

    // Fetch data for the reference from the database or from a prior request
    const dataResult = await executeQuery('SELECT * FROM Quote_details WHERE reference = ?', [reference]);
    
    if (dataResult.length === 0) {
      return res.send('Error: No data found for the provided reference.');
    }

    const data = dataResult[0]; // Assuming dataResult returns an array

    // Pass the data to the EJS view
    res.render('homepage', { data });

  } catch (error) {
    console.error('Error fetching quote details:', error);
    res.status(500).send('Internal server error');
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
app.get('/additems', async (req, res) => {
  try {
    const salePeoples = await executeQuery('SELECT sale_person, sale_cell, sale_email, saleRole FROM salePeople');
    const installDifficultyTypes = await executeQuery('SELECT install_diff FROM InstallDifficultyType');
    const slaMlaTypes = await executeQuery('SELECT sla_mla FROM SlaMlaType');
    const validateNumTypes = await executeQuery('SELECT validate_num_days FROM ValidateNumType');
    const productTypes = await executeQuery('SELECT product_type, labour_factor_hrs, maint_lab_factor FROM ProductType');
    const supplyTypes = await executeQuery('SELECT supply FROM SupplyType');

    const reference = req.query.reference;
    if (!reference) {
      return res.send('Error: No reference provided.');
    }

    res.render('additems', { 
      reference, 
      salePeoples, 
      installDifficultyTypes, 
      slaMlaTypes, 
      validateNumTypes, 
      productTypes, 
      supplyTypes 
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).send('Database error');
  }
});
app.post('/additems', async (req, res) => {
  try {
    const { 
      reference, bill, stock_code, description, qty, 
      product_type, install_diff, unit_cost, supply, 
      labour_hrs, labour_cost, labour_factor_hrs, maint_lab_factor
    } = req.body;

    if (!reference) {
      return res.send('Error: Reference is missing.');
    }

    // Check if the reference exists in Quote_details
    const referenceResult = await executeQuery(`SELECT * FROM Quote_details WHERE reference = ?`, [reference]);
    if (referenceResult.length === 0) {
      return res.send('Error: Reference does not exist in Quote_details');
    }

    // Insert or update the Bill entry
    const billResult = await executeQuery(`SELECT * FROM Bills WHERE bill = ? AND reference = ?`, [bill, reference]);
    if (billResult.length === 0) {
      await executeQuery(
        `INSERT INTO Bills (bill, reference, labour_hrs, labour_cost) VALUES (?, ?, ?, ?)`,
        [bill, reference, labour_hrs || 0, labour_cost || 0]
      );
      console.log('Bill inserted successfully');
    }

    // Insert the Item entry along with product_type and factors
    await executeQuery(
      `INSERT INTO Items (reference, bill, stock_code, description, qty, product_type, install_diff, unit_cost, supply, labour_factor_hrs, maint_lab_factor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reference, bill, stock_code, description, qty, product_type, install_diff, unit_cost, supply, labour_factor_hrs, maint_lab_factor]
    );

    res.redirect('/login');
  } catch (error) {
    console.error(error);
    res.send('Database error while processing request');
  }
});
// ✅ All items
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
    const equip_margin = 0.25; 
    const  labour_margin = 0.25;

 
    results.forEach(item => {
      item.equip_unit_rate = parseFloat((item.unit_cost / (1 - equip_margin)).toFixed(2));
      item.equip_total = parseFloat((item.equip_unit_rate * item.qty).toFixed(2));
      item.equipmentCost = parseFloat((item.unit_cost * item.qty).toFixed(2));
      item.labour_cost = parseFloat((item.labour_factor_hrs * item.qty).toFixed(2));
      item.unitLabRate = parseFloat(((item.labour_cost * item.labour_factor_hrs) / (1 - labour_margin)).toFixed(2));
      item.total_labour = parseFloat((item.unitLabRate * item.qty).toFixed(2))
      if (!groupedItems[item.bill]) {
        groupedItems[item.bill] = [];
      }
      groupedItems[item.bill].push(item);
    });

    res.render('allitems', { groupedItems });
  });
});
// ✅ Billing Page
app.get('/billing', async (req, res) => {
  const userRefNum = req.session.user?.reference;

  if (!userRefNum) return res.redirect('/');

  try {
    // Fetch items and relevant details from the database
    const itemsResult = await executeQuery(
      `SELECT i.bill, i.stock_code, i.description, i.qty, i.product_type, i.unit_cost, 
              i.maint_lab_factor, i.labour_factor_hrs,
              q.customer_name, q.customer_email, q.sale_person, q.sale_cell, q.job_description
       FROM items i
       JOIN quote_details q ON i.reference = q.reference
       WHERE i.reference = ?
       ORDER BY i.bill, i.reference`,
      [userRefNum]
    );

    if (itemsResult.length === 0) return res.send('No items found for this reference.');

    // Group items by the bill name
    const bills = itemsResult.reduce((acc, item) => {
      const bill = item.bill || 'Unknown Bill';
      if (!acc[bill]) acc[bill] = [];
      acc[bill].push(item);
      return acc;
    }, {});

    // Fixed extra costs
    const extraCosts = {
      Sundries_and_Consumables: 1529.47,
      Project_Management: 1058.82,
      Installation_Commissioning_Engineering: 3150.30
    };

    const equipmentMargin = 0.25;
    const labour_rate = 320; // Labour rate
    const pm_rate = 0.15; // Project Management rate
    const labour_margin = 0.25; // Labour margin
    const equip_sundries = 0.03; // Sundries cost per hour

    // Grouped items with calculated values
    const groupedItems = {
      reference: userRefNum,
      customer_name: itemsResult[0]?.customer_name || '',
      customer_email: itemsResult[0]?.customer_email || '',
      sale_person: itemsResult[0]?.sale_person || '',
      sale_cell: itemsResult[0]?.sale_cell || '',
      job_description: itemsResult[0]?.job_description || '',
      bills: Object.keys(bills).map(billName => {
        const items = bills[billName].map(item => {
          // Ensure all numeric values are properly parsed
          const qty = parseFloat(item.qty) || 0;
          const unitCost = parseFloat(item.unit_cost) || 0;
          const labourFactorHrs = parseFloat(item.labour_factor_hrs) || 0;
          const labourCost = parseFloat(item.labour_cost) || 0;
          const maintLabFactor = parseFloat(item.maint_lab_factor) || 0;

          // Calculate total price, equipment cost, and equipment selling
          const totalPrice = unitCost * qty;
          const equipmentCost = unitCost * qty;
          const equipmentSelling = (unitCost / (1 - equipmentMargin)) * qty;


  item.total_labour = parseFloat((item.unitLabRate * parseFloat(item.qty || 0)).toFixed(2));

          return {
            ...item,
            total_price: totalPrice.toFixed(2),
            equipment_cost: equipmentCost.toFixed(2),
            equipment_selling: equipmentSelling.toFixed(2),
            total_labour: item.total_labour 
          };
        });

        // Calculate totals for the bill
        const bill_equipment_cost = items.reduce((sum, item) => sum + parseFloat(item.equipment_cost || 0), 0);
        const bill_equipment_selling = items.reduce((sum, item) => sum + parseFloat(item.equipment_selling || 0), 0);
        let subtotal = items.reduce((sum, item) => sum + (parseFloat(item.unit_cost || 0) * parseFloat(item.qty || 0)), 0);

        // Add extra fixed costs to the subtotal
        subtotal += extraCosts.Sundries_and_Consumables;
        subtotal += extraCosts.Project_Management;
        subtotal += extraCosts.Installation_Commissioning_Engineering;

        // Calculate total labour hours and maintenance labour factor for this bill
        const totalLabourHours = items.reduce((sum, item) => sum + (parseFloat(item.labour_factor_hrs || 0) * parseFloat(item.qty || 0)), 0);
        const totalMaintLabFactor = items.reduce((sum, item) => sum + (parseFloat(item.maint_lab_factor || 0) * parseFloat(item.qty || 0)), 0);

        const bill_labourCost = items.reduce((sum, item) => sum + (parseFloat(item.labour_factor_hrs || 0) * parseFloat(item.qty || 0)), 0);
        const bill_labourSell = items.reduce((sum, item) => sum + parseFloat((item.total_labour || 0) * parseFloat(item.qty || 0)), 0);

        // Calculate project management costs and selling
        const pm_cost = labour_rate * (totalLabourHours * pm_rate);
        const pm_selling = (labour_rate / (1 - labour_margin)) * (totalLabourHours * pm_rate);

        // Calculate sundries costs and selling prices
        const sundries_cost = totalLabourHours * equip_sundries;
        const sundries_selling = totalLabourHours * equip_sundries / (1 - labour_margin);

        // Calculate the total selling and total cost for the bill
        const bill_tot_selling = bill_labourSell + bill_equipment_selling + pm_selling + sundries_selling;
        const bill_tot_cost = bill_labourCost + bill_equipment_cost + pm_cost + sundries_cost + totalLabourHours;

        return {
          bill: billName,
          items,
          subtotal: subtotal.toFixed(2),
          totalLabourHours: totalLabourHours.toFixed(2),
          totalMaintLabFactor: totalMaintLabFactor.toFixed(2),
          bill_equipment_cost: bill_equipment_cost.toFixed(2),
          bill_equipment_selling: bill_equipment_selling.toFixed(2),
          pm_cost: pm_cost.toFixed(2),
          pm_selling: pm_selling.toFixed(2),
          pm_hrs: (totalLabourHours * pm_rate).toFixed(2),
          sundries_cost: sundries_cost.toFixed(2),
          sundries_selling: sundries_selling.toFixed(2),
          bill_tot_selling: bill_tot_selling.toFixed(2),
          bill_tot_cost: bill_tot_cost.toFixed(2),
          bill_labourCost: bill_labourCost.toFixed(2), // **Fixed: Total labour cost for the bill**
          bill_labourSell: bill_labourSell.toFixed(2) // **Fixed: Total labour selling price for the bill**
        };
      })
    };

    // Render the billing page with the grouped items
    res.render('billing', { groupedItems });

  } catch (error) {
    console.error('Error fetching items:', error);
    res.send('Error retrieving items data.');
  }
});
// ✅ Print Page
app.get('/print', async (req, res) => {
  const userRefNum = req.session.user?.reference;

  if (!userRefNum) return res.redirect('/');

  try {
    const itemsResult = await executeQuery(`
      SELECT i.bill, i.stock_code, i.description, i.qty, i.product_type, i.install_diff_factor, i.unit_cost, i.maint_lab_factor, i.labour_factor_hrs,
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

    const extraCosts = {
      Sundries_and_Consumables: 1529.47,
      Project_Management: 1058.82,
      Installation_Commissioning_Engineering: 3150.30
    };

    const groupedItems = {
      reference: userRefNum,
      customer_name: itemsResult[0]?.customer_name || '',
      customer_email: itemsResult[0]?.customer_email || '',
      sale_person: itemsResult[0]?.sale_person || '',
      sale_cell: itemsResult[0]?.sale_cell || '',
      job_description: itemsResult[0]?.job_description || '',
      bills: Object.keys(bills).map(billName => {
        const items = bills[billName].map(item => ({
          ...item,
          total_price: (
            parseFloat(item.unit_cost || 0) * parseFloat(item.qty || 0)
          ).toFixed(2)
        }));

        let subtotal = items.reduce((sum, item) => {
          return sum + (parseFloat(item.unit_cost || 0) * parseFloat(item.qty || 0));
        }, 0);

        // Add extra fixed costs to subtotal
        subtotal += extraCosts.Sundries_and_Consumables;
        subtotal += extraCosts.Project_Management;
        subtotal += extraCosts.Installation_Commissioning_Engineering;

        // Calculate total labor hours for this bill
        const totalLabourHours = items.reduce((total, item) => {
          return total + (parseFloat(item.labour_factor_hrs || 0));
        }, 0);

        return {
          bill: billName,
          items,
          subtotal: subtotal.toFixed(2),
          totalLabourHours: totalLabourHours.toFixed(2)  // Add total labour hours for the bill
        };
      })
    };

    res.render('print', { groupedItems });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.send('Error retrieving items data.');
  }
});
// ✅ Edit item route (GET)
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
// ✅ DELETE(Post)
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
// ✅ Overview
app.get('/overview', async (req, res) => {
  const userRefNum = req.session.user?.reference;

  if (!userRefNum) return res.redirect('/');

  try {
    // Fetch items and relevant details from the database
    const itemsResult = await executeQuery(
      `SELECT i.bill, i.stock_code, i.description, i.qty, i.product_type, i.unit_cost, 
              i.maint_lab_factor, i.labour_factor_hrs,
              q.customer_name,q.customer_cell, q.customer_email, q.sale_person, q.sale_cell, q.job_description
       FROM items i
       JOIN quote_details q ON i.reference = q.reference
       WHERE i.reference = ? 
       ORDER BY i.bill, i.reference`,
      [userRefNum]
    );

    if (itemsResult.length === 0) return res.send('No items found for this reference.');

    // Group items by the bill name
    const bills = itemsResult.reduce((acc, item) => {
      const bill = item.bill || 'Unknown Bill';
      if (!acc[bill]) acc[bill] = [];
      acc[bill].push(item);
      return acc;
    }, {});

    // Fixed extra costs
    const extraCosts = {
      Sundries_and_Consumables: 1529.47,
      Project_Management: 1058.82,
      Installation_Commissioning_Engineering: 3150.30
    };

    const equipmentMargin = 0.25;
    const labour_rate = 320; 
    const pm_rate = 0.15; 
    const labour_margin = 0.25; 
    const equip_sundries = 0.03; 

    // Grouped items with calculated values
    const groupedItems = {
      reference: userRefNum,
      customer_name: itemsResult[0]?.customer_name || '',
      customer_cell: itemsResult[0]?.customer_cell || '',
      customer_email: itemsResult[0]?.customer_email || '',
      sale_person: itemsResult[0]?.sale_person || '',
      sale_cell: itemsResult[0]?.sale_cell || '',
      job_description: itemsResult[0]?.job_description || '',
      bills: Object.keys(bills).map(billName => {
        const items = bills[billName].map(item => {
          const qty = parseFloat(item.qty) || 0;
          const unitCost = parseFloat(item.unit_cost) || 0;
          const labourFactorHrs = parseFloat(item.labour_factor_hrs) || 0;
          const labourCost = parseFloat(item.labour_cost) || 0;
          const maintLabFactor = parseFloat(item.maint_lab_factor) || 0;

          const totalPrice = unitCost * qty;
          const equipmentCost = unitCost * qty;
          const equipmentSelling = (unitCost / (1 - equipmentMargin)) * qty;

          item.total_labour = parseFloat((item.unitLabRate * parseFloat(item.qty || 0)).toFixed(2));

          return {
            ...item,
            total_price: totalPrice.toFixed(2),
            equipment_cost: equipmentCost.toFixed(2),
            equipment_selling: equipmentSelling.toFixed(2),
            total_labour: item.total_labour
          };
        });

        const bill_equipment_cost = items.reduce((sum, item) => sum + parseFloat(item.equipment_cost || 0), 0);
        const bill_equipment_selling = items.reduce((sum, item) => sum + parseFloat(item.equipment_selling || 0), 0);
        let subtotal = items.reduce((sum, item) => sum + (parseFloat(item.unit_cost || 0) * parseFloat(item.qty || 0)), 0);

        subtotal += extraCosts.Sundries_and_Consumables;
        subtotal += extraCosts.Project_Management;
        subtotal += extraCosts.Installation_Commissioning_Engineering;

        const totalLabourHours = items.reduce((sum, item) => sum + (parseFloat(item.labour_factor_hrs || 0) * parseFloat(item.qty || 0)), 0);
        const totalMaintLabFactor = items.reduce((sum, item) => sum + (parseFloat(item.maint_lab_factor || 0) * parseFloat(item.qty || 0)), 0);

        const bill_labourCost = items.reduce((sum, item) => sum + (parseFloat(item.labour_factor_hrs || 0) * parseFloat(item.qty || 0)), 0);
        const bill_labourSell = items.reduce((sum, item) => sum + parseFloat((item.total_labour || 0) * parseFloat(item.qty || 0)), 0);

        const pm_cost = labour_rate * (totalLabourHours * pm_rate);
        const pm_selling = (labour_rate / (1 - labour_margin)) * (totalLabourHours * pm_rate);

        const sundries_cost = totalLabourHours * equip_sundries;
        const sundries_selling = totalLabourHours * equip_sundries / (1 - labour_margin);

        const bill_tot_selling = bill_labourSell + bill_equipment_selling + pm_selling + sundries_selling;
        const bill_tot_cost = bill_labourCost + bill_equipment_cost + pm_cost + sundries_cost + totalLabourHours;

        return {
          bill: billName,
          items,
          subtotal: subtotal.toFixed(2),
          totalLabourHours: totalLabourHours.toFixed(2),
          totalMaintLabFactor: totalMaintLabFactor.toFixed(2),
          bill_equipment_cost: bill_equipment_cost.toFixed(2),
          bill_equipment_selling: bill_equipment_selling.toFixed(2),
          pm_cost: pm_cost.toFixed(2),
          pm_selling: pm_selling.toFixed(2),
          pm_hrs: (totalLabourHours * pm_rate).toFixed(2),
          sundries_cost: sundries_cost.toFixed(2),
          sundries_selling: sundries_selling.toFixed(2),
          bill_tot_selling: bill_tot_selling.toFixed(2),
          bill_tot_cost: bill_tot_cost.toFixed(2),
          bill_labourCost: bill_labourCost.toFixed(2),
          bill_labourSell: bill_labourSell.toFixed(2)
        };
      })
    };

     // Calculate project hours, days, and weeks
     const totalLabourHours = Object.values(groupedItems.bills).reduce((sum, bill) => sum + parseFloat(bill.totalLabourHours || 0), 0);
     const projectDays = totalLabourHours / 8;  
     const projectWeeks = projectDays / 5;  
 
     // Add to groupedItems for use in the EJS template
     groupedItems.projectHrs = totalLabourHours.toFixed(2);
     groupedItems.projectDays = projectDays.toFixed(2);
     groupedItems.projectWeeks = projectWeeks.toFixed(2);
 
// Function to safely parse and round numbers to 2 decimal places
const parseAndRound = (value) => Number(parseFloat(value || 0).toFixed(2));

// Calculate overall totals for the reference
const totals = {
    bill_equipment_cost: parseAndRound(groupedItems.bills.reduce((sum, bill) => sum + parseFloat(bill.bill_equipment_cost || 0), 0)),
    bill_equipment_selling: parseAndRound(groupedItems.bills.reduce((sum, bill) => sum + parseFloat(bill.bill_equipment_selling || 0), 0)),
    bill_labourCost: parseAndRound(groupedItems.bills.reduce((sum, bill) => sum + parseFloat(bill.bill_labourCost || 0), 0)),
    bill_labourSell: parseAndRound(groupedItems.bills.reduce((sum, bill) => sum + parseFloat(bill.bill_labourSell || 0), 0)),
    pm_cost: parseAndRound(groupedItems.bills.reduce((sum, bill) => sum + parseFloat(bill.pm_cost || 0), 0)),
    pm_selling: parseAndRound(groupedItems.bills.reduce((sum, bill) => sum + parseFloat(bill.pm_selling || 0), 0)),
    sundries_cost: parseAndRound(groupedItems.bills.reduce((sum, bill) => sum + parseFloat(bill.sundries_cost || 0), 0)),
    sundries_selling: parseAndRound(groupedItems.bills.reduce((sum, bill) => sum + parseFloat(bill.sundries_selling || 0), 0))
};

// Total Sell and Cost Project and round to two decimals
totals.totalSellProject = parseAndRound(
    totals.bill_equipment_selling + 
    totals.bill_labourSell + 
    totals.sundries_selling + 
    totals.pm_selling
);

totals.totalCostProject = parseAndRound(
    totals.bill_equipment_cost + 
    totals.bill_labourCost + 
    totals.sundries_cost + 
    totals.pm_cost
);


    // Calculate GM % for equipment, labour, sundries, and PM and round to two decimals
    totals.gmEquip = ((totals.bill_equipment_selling - totals.bill_equipment_cost) / totals.bill_equipment_selling) * 100;
    totals.gmLabour = ((totals.bill_labourSell - totals.bill_labourCost) / totals.bill_labourSell ) * 100;
    totals.gmSundries = ((totals.sundries_selling - totals.sundries_cost) / totals.sundries_selling) * 100;
    totals.gmPm = ((totals.pm_selling - totals.pm_cost) / totals.pm_selling) * 100;


    // Round to two decimals
    totals.gmEquip = totals.gmEquip.toFixed(2);
    totals.gmLabour = totals.gmLabour.toFixed(2);
    totals.gmSundries = totals.gmSundries.toFixed(2);
    totals.gmPm = totals.gmPm.toFixed(2);

    // Project % calculations and round to two decimals
    totals.pEquipment = (totals.bill_equipment_selling / totals.totalSellProject) * 100;
    totals.pLabour = (totals.bill_labourSell / totals.totalSellProject) * 100;
    totals.pSundries = (totals.sundries_selling / totals.totalSellProject) * 100;
    totals.pProjectM = (totals.pm_selling / totals.totalSellProject) * 100;

    totals.pEquipment = totals.pEquipment.toFixed(2);
    totals.pLabour = totals.pLabour.toFixed(2);
    totals.pSundries = totals.pSundries.toFixed(2);
    totals.pProjectM = totals.pProjectM.toFixed(2);

   
    
    const vat = 0.14;
    totals.totalTax = totals.totalSellProject * vat;
    totals.totalVatSell = totals.totalSellProject + totals.totalTax;
    

// Round to two decimals
totals.totalTax = totals.totalTax.toFixed(2);
totals.totalVatSell = totals.totalVatSell.toFixed(2);

totals.totalGrossMargin = totals.totalSellProject - totals.totalCostProject;
totals.actualGrossMargin = ((totals.totalGrossMargin) / totals.totalSellProject) * 100;

totals.totalGrossMargin = totals.totalGrossMargin.toFixed(2);
totals.actualGrossMargin = totals.actualGrossMargin.toFixed(2);

    groupedItems.referenceTotals = totals;

    // Render the overview page with the grouped items and totals
    res.render('overview', { groupedItems });

  } catch (error) {
    console.error('Error fetching items:', error);
    res.send('Error retrieving items data.');
  }
});

app.get('/billSummary', async (req, res) => {
  const userRefNum = req.session.user?.reference;
  if (!userRefNum) return res.redirect('/');

  try {
    // Fetch items and relevant details from the database
    const itemsResult = await executeQuery(
      `SELECT i.bill, i.stock_code, i.description, i.qty, i.product_type, i.unit_cost, 
              i.maint_lab_factor, i.labour_factor_hrs,
              q.customer_name,q.customer_cell, q.customer_email, q.sale_person, q.sale_cell, q.job_description
       FROM items i
       JOIN quote_details q ON i.reference = q.reference
       WHERE i.reference = ?
       ORDER BY i.bill, i.reference`,
      [userRefNum]
    );

    if (itemsResult.length === 0) return res.send('No items found for this reference.');

    // Group items by the bill name
    const bills = itemsResult.reduce((acc, item) => {
      const bill = item.bill || 'Unknown Bill';
      if (!acc[bill]) acc[bill] = [];
      acc[bill].push(item);
      return acc;
    }, {});

    // Fixed extra costs
    const extraCosts = {
      Sundries_and_Consumables: 1529.47,
      Project_Management: 1058.82,
      Installation_Commissioning_Engineering: 3150.30
    };

    const equipmentMargin = 0.25;
    const labour_rate = 320; // Labour rate
    const pm_rate = 0.15; // Project Management rate
    const labour_margin = 0.25; // Labour margin
    const equip_sundries = 0.03; // Sundries cost per hour

    // Grouped items with calculated values
    const groupedBills = Object.keys(bills).map(billName => {
      const items = bills[billName].map(item => {
        // Ensure all numeric values are properly parsed
        const qty = parseFloat(item.qty) || 0;
        const unitCost = parseFloat(item.unit_cost) || 0;
        const labourFactorHrs = parseFloat(item.labour_factor_hrs) || 0;
        const labourCost = parseFloat(item.labour_cost) || 0;
        const maintLabFactor = parseFloat(item.maint_lab_factor) || 0;

        // Calculate total price, equipment cost, and equipment selling
        const totalPrice = unitCost * qty;
        const equipmentCost = unitCost * qty;
        const equipmentSelling = (unitCost / (1 - equipmentMargin)) * qty;

        // Calculate total labour cost
        item.total_labour = parseFloat((item.unitLabRate * qty).toFixed(2));

        return {
          ...item,
          total_price: totalPrice.toFixed(2),
          equipment_cost: equipmentCost.toFixed(2),
          equipment_selling: equipmentSelling.toFixed(2),
          total_labour: item.total_labour
        };
      });

      // Calculate totals for the bill
      const bill_equipment_cost = items.reduce((sum, item) => sum + parseFloat(item.equipment_cost || 0), 0);
      const bill_equipment_selling = items.reduce((sum, item) => sum + parseFloat(item.equipment_selling || 0), 0);
      let subtotal = items.reduce((sum, item) => sum + (parseFloat(item.unit_cost || 0) * parseFloat(item.qty || 0)), 0);

      // Add extra fixed costs to the subtotal
      subtotal += extraCosts.Sundries_and_Consumables;
      subtotal += extraCosts.Project_Management;
      subtotal += extraCosts.Installation_Commissioning_Engineering;

      // Calculate total selling for the bill
      const totalSelling = items.reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0);
      
      // Calculate VAT (assuming 15% VAT rate)
      const vatRate = 0.15;
      const vatAmount = totalSelling * vatRate;
      
      // Calculate VAT-included price
      const vatIncluded = totalSelling + vatAmount;

      return {
        bill: billName,
        bill_tot_selling: totalSelling.toFixed(2),
        vat_amount: vatAmount.toFixed(2),
        vat_included: vatIncluded.toFixed(2)
      };
    });

    // Calculate the sum of all bill_tot_selling values
    const totalSellingSum = groupedBills.reduce((sum, bill) => sum + parseFloat(bill.bill_tot_selling || 0), 0);

    // VAT and VAT-included for the entire sum
    const vatAmountForAll = totalSellingSum * 0.15;
    const totalWithVat = totalSellingSum + vatAmountForAll;

    // Prepare data for the bill summary page
    const billSummaryData = {
      reference: userRefNum,
      customer_name: itemsResult[0]?.customer_name || '',
      customer_cell: itemsResult[0]?.customer_cell || '',
      customer_email: itemsResult[0]?.customer_email || '',
      sale_person: itemsResult[0]?.sale_person || '',
      sale_cell: itemsResult[0]?.sale_cell || '',
      job_description: itemsResult[0]?.job_description || '',
      bills: groupedBills, // Pass the grouped bills with the bill_tot_selling
      totalSellingSum: totalSellingSum.toFixed(2),
      vatAmountForAll: vatAmountForAll.toFixed(2),
      totalWithVat: totalWithVat.toFixed(2)
    };

    // Render the billSummary page
    res.render('billSummary', { billSummaryData });

  } catch (error) {
    console.error('Error fetching items:', error);
    res.send('Error retrieving items data.');
  }
});

// ✅ Start Server
app.listen(1200, () => {
  console.log('Server running on http://localhost:1200');
});
