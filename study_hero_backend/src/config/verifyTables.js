const db = require('./db');

async function verifyTables() {
    try {
        // Get all tables
        const [tables] = await db.query('SHOW TABLES');
        console.log('\n📊 Available Tables:');
        tables.forEach(table => {
            console.log(`- ${table[`Tables_in_${process.env.DB_NAME}`]}`);
        });

        // Get structure of each table
        console.log('\n🔍 Table Structures:');
        for (const table of tables) {
            const tableName = table[`Tables_in_${process.env.DB_NAME}`];
            const [columns] = await db.query(`DESCRIBE ${tableName}`);
            
            console.log(`\nTable: ${tableName}`);
            console.log('Columns:');
            columns.forEach(column => {
                console.log(`- ${column.Field} (${column.Type}) ${column.Null === 'NO' ? 'NOT NULL' : ''} ${column.Key ? `[${column.Key}]` : ''}`);
            });
        }

        console.log('\n✅ Database verification complete!');
    } catch (error) {
        console.error('❌ Error verifying tables:', error);
    } finally {
        db.end();
    }
}

verifyTables(); 