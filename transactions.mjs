import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();
console.log(process.env.DATABASE_URL)

neonConfig.webSocketConstructor = ws; // Configure WebSocket for NeonDB

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (err) => console.error(err)); // Handle connection errors

const transact = async (quantity, productId) => {
  const client = await pool.connect(); // Connect to the database

  try {
    await client.query('BEGIN'); // Start a transaction

    // Step 1: Fetch the stock and price of the product
    const {
      rows: [{ stock: availableStock, price: productPrice }],
    } = await client.query('SELECT stock, price FROM products WHERE product_id = $1', [productId]);

    if (availableStock >= quantity) {
      // Step 2: Calculate total price
      const totalPrice = quantity * productPrice;

      // Step 3: Insert the order
      await client.query(
        'INSERT INTO orders (product_id, quantity, total_price) VALUES ($1, $2, $3)',
        [productId, quantity, totalPrice]
      );

      // Step 4: Update the product stock
      await client.query('UPDATE products SET stock = stock - $1 WHERE product_id = $2', [
        quantity,
        productId,
      ]);

      await client.query('COMMIT'); // Commit the transaction
      console.log('Transaction completed successfully!');
    } else {
      // Handle insufficient stock
      console.error(
        `Insufficient stock for product ID: ${productId}. Available: ${availableStock}, Required: ${quantity}`
      );
      await client.query('ROLLBACK'); // Rollback the transaction
    }
  } catch (err) {
    await client.query('ROLLBACK'); // Rollback on error
    console.error('Transaction failed:', err);
  } finally {
    client.release(); // Release the client
  }
};

// Example usage
transact(20, 1).then(() => pool.end()); // Run the transaction and close the pool
