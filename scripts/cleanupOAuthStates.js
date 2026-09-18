// /scripts/cleanupOAuthStates.js
/**
 * OAuth State Cleanup Script
 * 
 * Removes expired OAuth state tokens from the database.
 * Should be run periodically (e.g., via cron job).
 * 
 * Usage:
 *   node scripts/cleanupOAuthStates.js
 * 
 * Recommended cron schedule:
 *   0 * * * * (hourly)
 *   or
 *   0 0 * * * (daily)
 */

require('dotenv').config();
const userModel = require('../models/userModel');

async function cleanupExpiredStates() {
  console.log('Starting OAuth state cleanup...');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    const result = await userModel.cleanExpiredOAuthStates();
    
    console.log(`Successfully deleted ${result.length || 0} expired OAuth state(s)`);
    console.log('Cleanup completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('Cleanup failed:', error.message);
    process.exit(1);
  }
}

// Run cleanup
cleanupExpiredStates()
  .catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
