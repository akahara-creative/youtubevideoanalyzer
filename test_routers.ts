import 'dotenv/config';

async function testImport() {
  try {
    console.log('Importing routers...');
    const routers = await import('./server/routers');
    console.log('Routers imported successfully');
  } catch (error) {
    console.error('Error importing routers:', error);
  }
}

testImport();
